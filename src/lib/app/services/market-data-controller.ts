import {
  SeriesData,
  type BarsRequest,
  type Candle,
  type ChartEngine,
  type DataProvider,
  type EventBus,
  type SymbolInfo,
  type TimeframeId,
} from '@/lib/core';
import type { AppEventMap } from '../app-events';
import { APP_CONFIG } from '../config';

export interface MarketState {
  readonly symbol: SymbolInfo;
  readonly timeframe: TimeframeId;
}

type PrependListener = (bars: readonly Candle[]) => void;

/**
 * Loads bars for the active symbol/timeframe, lazily prepends older history when the viewport
 * nears the left edge, and cancels stale requests. The full loaded history lives here; the
 * engine normally displays it directly, but a replay session can take over what is displayed.
 */
export class MarketDataController {
  private current: MarketState;
  private series = new SeriesData();
  private hasMore = true;
  private loadingHistory = false;
  private abort: AbortController | null = null;
  private generation = 0;
  private displayOverride = false;
  private prependListeners = new Set<PrependListener>();
  private readonly offLeftEdge: () => void;

  constructor(
    private readonly engine: ChartEngine,
    private readonly provider: DataProvider,
    private readonly events: EventBus<AppEventMap>,
    initial: { symbol: string; timeframe: TimeframeId },
    private readonly initialBars: number = APP_CONFIG.initialBars,
  ) {
    this.current = { symbol: provider.getSymbolInfo(initial.symbol), timeframe: initial.timeframe };
    this.offLeftEdge = engine.events.on(
      'viewport:near-left-edge',
      () => void this.loadMoreHistory(),
    );
  }

  get state(): MarketState {
    return this.current;
  }

  /** Full loaded history for the current symbol/timeframe. */
  get data(): SeriesData {
    return this.series;
  }

  get canLoadMore(): boolean {
    return this.hasMore;
  }

  /** While true (replay), loaded data is not pushed to the engine. */
  setDisplayOverride(active: boolean): void {
    this.displayOverride = active;
    if (!active) this.engine.setData(this.series, { resetView: false });
  }

  onPrepend(listener: PrependListener): () => void {
    this.prependListeners.add(listener);
    return () => this.prependListeners.delete(listener);
  }

  async load(
    symbol: string,
    timeframe: TimeframeId,
    opts: { resetView?: boolean } = {},
  ): Promise<boolean> {
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    const gen = ++this.generation;
    const info = this.provider.getSymbolInfo(symbol);
    this.current = { symbol: info, timeframe };
    this.events.emit('market:changed', this.current);
    this.events.emit('market:loading', { loading: true, kind: 'initial' });
    try {
      const res = await this.provider.fetchBars(
        { symbol: info.symbol, timeframe, limit: this.initialBars },
        abort.signal,
      );
      if (gen !== this.generation) return false;
      this.series = SeriesData.fromCandles(res.bars);
      this.hasMore = res.hasMoreHistory;
      this.loadingHistory = false;
      this.engine.setSymbol(info);
      this.engine.setTimeframe(timeframe);
      if (!this.displayOverride)
        this.engine.setData(this.series, { resetView: opts.resetView ?? true });
      this.events.emit('market:source', { source: res.source });
      return true;
    } catch (e) {
      if (!abort.signal.aborted) {
        this.events.emit('market:error', { message: e instanceof Error ? e.message : String(e) });
      }
      return false;
    } finally {
      if (gen === this.generation)
        this.events.emit('market:loading', { loading: false, kind: 'initial' });
    }
  }

  async loadMoreHistory(): Promise<number> {
    if (this.loadingHistory || !this.hasMore || this.series.length === 0) return 0;
    this.loadingHistory = true;
    const gen = this.generation;
    const firstTime = this.series.time[0]!;
    this.events.emit('market:loading', { loading: true, kind: 'history' });
    try {
      const res = await this.provider.fetchBars({
        symbol: this.current.symbol.symbol,
        timeframe: this.current.timeframe,
        endTime: firstTime - 1,
        limit: APP_CONFIG.historyPageBars,
      });
      if (gen !== this.generation) return 0;
      const older = res.bars.filter((b) => b.time < firstTime);
      this.hasMore = res.hasMoreHistory && older.length > 0;
      if (older.length > 0) {
        this.series.prepend(older);
        for (const l of this.prependListeners) l(older);
      }
      return older.length;
    } catch {
      return 0;
    } finally {
      this.loadingHistory = false;
      this.events.emit('market:loading', { loading: false, kind: 'history' });
    }
  }

  /** Arbitrary range fetch for the current symbol (replay uses finer timeframes). */
  fetchRange(req: Omit<BarsRequest, 'symbol'>, signal?: AbortSignal): Promise<Candle[]> {
    return this.provider
      .fetchBars({ ...req, symbol: this.current.symbol.symbol }, signal)
      .then((r) => r.bars);
  }

  destroy(): void {
    this.abort?.abort();
    this.offLeftEdge();
    this.prependListeners.clear();
  }
}
