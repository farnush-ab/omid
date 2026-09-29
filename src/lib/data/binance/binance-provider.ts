import type { BarsRequest, BarsResponse, Candle, DataProvider } from '@/lib/core';
import { isTimeframeId } from '@/lib/core';
import { searchSymbols, symbolInfo } from '../symbols';
import { BINANCE_MAX_LIMIT } from './klines';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

interface KlinesResponse {
  bars: Candle[];
  source: string;
  hasMoreHistory: boolean;
}

/** Binance REST via the app's /api/klines proxy (which caches and can fall back itself). */
export class BinanceProvider implements DataProvider {
  readonly id = 'binance';
  readonly label = 'Binance';

  constructor(
    private readonly fetchFn: FetchFn,
    private readonly endpoint = '/api/klines',
  ) {}

  async fetchBars(req: BarsRequest, signal?: AbortSignal): Promise<BarsResponse> {
    if (!isTimeframeId(req.timeframe)) throw new Error(`Unsupported timeframe ${req.timeframe}`);
    const pages: Candle[][] = [];
    let remaining = req.limit;
    let endTime = req.endTime;
    let source = 'binance';
    let hasMore = true;
    // Binance caps a request at 1000 bars; page backwards for larger requests.
    while (remaining > 0 && hasMore) {
      const limit = Math.min(BINANCE_MAX_LIMIT, remaining);
      const page = await this.request({ ...req, limit, endTime }, signal);
      source = page.source;
      pages.unshift(page.bars);
      remaining -= page.bars.length;
      hasMore = page.hasMoreHistory && page.bars.length === limit;
      const first = page.bars[0];
      if (!first || req.startTime !== undefined) break;
      endTime = first.time - 1;
    }
    return { bars: pages.flat(), source, hasMoreHistory: hasMore };
  }

  private async request(req: BarsRequest, signal?: AbortSignal): Promise<KlinesResponse> {
    const q = new URLSearchParams({
      symbol: req.symbol,
      timeframe: req.timeframe,
      limit: String(req.limit),
    });
    if (req.startTime !== undefined) q.set('startTime', String(req.startTime));
    if (req.endTime !== undefined) q.set('endTime', String(req.endTime));
    const init: RequestInit = signal ? { signal } : {};
    const res = await this.fetchFn(`${this.endpoint}?${q.toString()}`, init);
    if (!res.ok) throw new Error(`klines ${res.status}`);
    const json = (await res.json()) as KlinesResponse;
    if (!Array.isArray(json.bars)) throw new Error('klines: malformed response');
    return json;
  }

  searchSymbols = searchSymbols;
  getSymbolInfo = symbolInfo;
}
