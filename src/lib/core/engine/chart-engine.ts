import type { Clock, FrameScheduler, Timer } from '../contracts/runtime';
import type { Series, SeriesDefinition } from '../contracts/series';
import type { SymbolInfo } from '../contracts/symbol';
import type { Theme } from '../contracts/theme';
import { RangeMinMax } from '../data/range-min-max';
import { SeriesData, type SeriesChange } from '../data/series-data';
import { EventBus } from '../events/event-bus';
import type { ChartEventMap, ViewportInfo } from '../events/chart-events';
import type { InteractionHandler } from '../interaction/types';
import { PointerRouter } from '../interaction/pointer-router';
import { DEFAULT_CHART_OPTIONS, type ChartOptions } from '../model/chart-options';
import type { ChartCoordinates } from '../model/coordinates';
import { computeLayout, type ChartLayout } from '../model/layout';
import { TimeIndex } from '../model/time-index';
import type { CrosshairState, FrameState, LayerRenderer } from '../render/frame';
import { LayerManager } from '../render/layer-manager';
import { ALL_LAYERS, LayerMask, type LayerId } from '../render/layers';
import { RenderLoop } from '../render/render-loop';
import { TimeWeights } from '../scales/time-ticks';
import { getTimeframe, type Timeframe, type TimeframeId } from '../time/timeframes';
import { DomHost } from './dom-host';
import { FrameBuilder, type PriceRangeContributor } from './frame-builder';
import { createNavigationTarget } from './navigation';
import { registerBuiltInRenderers } from './builtin-renderers';
import { ViewportController } from './viewport-controller';
import { ENGINE_CONFIG } from '../config';

export interface EngineRuntime {
  readonly frames: FrameScheduler;
  readonly timer: Timer;
  readonly clock: Clock;
  devicePixelRatio(): number;
}

export interface ChartEngineInit {
  readonly container: HTMLElement;
  readonly runtime: EngineRuntime;
  readonly series: SeriesDefinition;
  readonly theme: Theme;
  readonly symbol: SymbolInfo;
  readonly timeframe: TimeframeId;
  readonly options?: Partial<ChartOptions>;
}

/** Snaps the crosshair price (magnet). Returns null to keep the raw price. */
export type CrosshairSnapper = (barIndex: number, price: number, y: number) => number | null;

/**
 * Facade over the chart core. Owns data, viewport, layers and interaction; plugins extend it
 * through renderers, interaction handlers and price-range contributors.
 */
export class ChartEngine {
  readonly events = new EventBus<ChartEventMap>();
  readonly coords: ChartCoordinates;
  readonly viewport: ViewportController;
  private readonly host: DomHost;
  private readonly layers: LayerManager;
  private readonly loop: RenderLoop;
  private readonly router: PointerRouter;
  private readonly frames = new FrameBuilder();
  private readonly timeIndex: TimeIndex;
  private readonly series: Series;
  private data = new SeriesData();
  private minMax = new RangeMinMax(this.data);
  private weights = new TimeWeights(this.data);
  private unsubscribeData: () => void = () => undefined;
  private knownLength = 0;
  private options: ChartOptions;
  private theme: Theme;
  private symbol: SymbolInfo;
  private timeframe: Timeframe;
  private crosshair: CrosshairState | null = null;
  private handlerList: InteractionHandler[] = [];
  private contributors: PriceRangeContributor[] = [];
  private snapper: CrosshairSnapper | null = null;
  private layout: ChartLayout = computeLayout(0, 0, 0, null);
  private size = { width: 0, height: 0, dpr: 1 };
  private nearLeftEmitted = false;

  constructor(private readonly init: ChartEngineInit) {
    this.options = { ...DEFAULT_CHART_OPTIONS, ...init.options };
    this.theme = init.theme;
    this.symbol = init.symbol;
    this.timeframe = getTimeframe(init.timeframe);
    this.viewport = new ViewportController(init.runtime.clock);
    this.timeIndex = new TimeIndex(
      () => this.data,
      () => this.timeframe.ms,
    );
    this.coords = this.createCoordinates();
    this.host = new DomHost(init.container, (w, h) => this.resize(w, h));
    this.layers = new LayerManager(this.host.surfaces);
    this.loop = new RenderLoop(init.runtime.frames, (mask) => this.renderFrame(mask));
    this.series = init.series.create({ data: () => this.data, minMax: () => this.minMax });
    registerBuiltInRenderers(this.layers, this.series);
    this.router = new PointerRouter(
      this.host.root,
      createNavigationTarget(this, this.host),
      init.runtime.timer,
    );
    this.applyOptions();
    this.setData(this.data, { resetView: true });
    const { width, height } = this.host.size;
    this.resize(width, height);
  }

  // ---- data -------------------------------------------------------------------------------

  get seriesData(): SeriesData {
    return this.data;
  }

  setData(data: SeriesData, opts: { resetView?: boolean } = {}): void {
    this.unsubscribeData();
    if (data !== this.data) {
      this.minMax.dispose();
      this.weights.dispose();
      this.data = data;
      this.minMax = new RangeMinMax(data);
      this.weights = new TimeWeights(data);
    }
    this.unsubscribeData = data.onChange((c) => this.onDataChange(c));
    this.knownLength = data.length;
    this.nearLeftEmitted = false;
    this.viewport.setDataLength(data.length);
    if (opts.resetView) {
      this.viewport.resetTime();
      this.viewport.price.autoScale = true;
      this.options.autoScale = true;
    }
    this.events.emit('data:changed', { length: data.length, reason: 'set' });
    this.viewportChanged();
  }

  private onDataChange(c: SeriesChange): void {
    const n = this.data.length;
    if (c.kind === 'prepend') {
      this.viewport.onPrepend(c.count);
      this.viewport.setDataLength(n);
      this.nearLeftEmitted = false;
    } else if (c.kind === 'update') {
      this.viewport.onAppend(this.knownLength, n, this.viewport.atLatest);
    } else {
      this.viewport.setDataLength(n);
    }
    this.knownLength = n;
    this.events.emit('data:changed', { length: n, reason: c.kind === 'reset' ? 'set' : c.kind });
    this.viewportChanged();
  }

  setSymbol(symbol: SymbolInfo): void {
    this.symbol = symbol;
    this.invalidate(ALL_LAYERS);
  }

  getSymbol(): SymbolInfo {
    return this.symbol;
  }

  setTimeframe(id: TimeframeId): void {
    this.timeframe = getTimeframe(id);
    this.invalidate(ALL_LAYERS);
  }

  getTimeframe(): Timeframe {
    return this.timeframe;
  }

  // ---- options & theme --------------------------------------------------------------------

  getOptions(): Readonly<ChartOptions> {
    return this.options;
  }

  setOptions(patch: Partial<ChartOptions>): void {
    this.options = { ...this.options, ...patch };
    this.applyOptions();
    this.events.emit('options:changed', this.options);
    this.invalidate(ALL_LAYERS);
  }

  private applyOptions(): void {
    const o = this.options;
    const price = this.viewport.price;
    price.setMode(o.scaleMode);
    price.inverted = o.invertScale;
    if (o.lockScale) o.autoScale = false;
    price.autoScale = o.autoScale;
    this.viewport.setLockRatio(o.lockScale);
    this.viewport.setRightMargin(o.rightMargin);
  }

  /** Called when a gesture changed auto-scale implicitly (price-axis drag). */
  syncAutoScaleOption(): void {
    if (this.options.autoScale !== this.viewport.price.autoScale) {
      this.options = { ...this.options, autoScale: this.viewport.price.autoScale };
      this.events.emit('options:changed', this.options);
    }
  }

  getTheme(): Theme {
    return this.theme;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.events.emit('theme:changed', theme);
    this.invalidate(ALL_LAYERS);
  }

  // ---- viewport ---------------------------------------------------------------------------

  getViewport(): ViewportInfo {
    const { from, to } = this.viewport.time.visibleRange(this.data.length);
    return {
      from,
      to,
      barSpacing: this.viewport.time.barSpacing,
      rightIndex: this.viewport.time.rightIndex,
      atLatest: this.viewport.atLatest,
    };
  }

  viewportChanged(): void {
    this.events.emit('viewport:changed', this.getViewport());
    const left = this.viewport.time.leftIndex;
    if (
      !this.nearLeftEmitted &&
      this.data.length > 0 &&
      left < ENGINE_CONFIG.historyThresholdBars
    ) {
      this.nearLeftEmitted = true;
      this.events.emit('viewport:near-left-edge', { firstTime: this.data.time[0]! });
    }
    this.invalidate(ALL_LAYERS);
  }

  resetView(): void {
    this.viewport.resetTime();
    this.resetPriceScale();
  }

  resetPriceScale(): void {
    this.setOptions({ autoScale: true, lockScale: false });
    this.viewportChanged();
  }

  resetTimeScale(): void {
    this.viewport.resetTime();
    this.viewportChanged();
  }

  scrollToLatest(animated = true): void {
    this.viewport.scrollToLatest(animated);
    this.viewportChanged();
  }

  scrollBars(bars: number): void {
    this.viewport.scrollBars(bars);
    this.viewportChanged();
  }

  zoom(factor: number): void {
    const last = this.viewport.time.indexToX(this.data.lastIndex);
    const anchor = last >= 0 && last <= this.layout.plot.width ? last : this.layout.plot.width / 2;
    this.viewport.zoomTimeAt(anchor, factor);
    this.viewportChanged();
  }

  // ---- crosshair --------------------------------------------------------------------------

  setCrosshairSnapper(snapper: CrosshairSnapper | null): void {
    this.snapper = snapper;
  }

  setCrosshair(state: CrosshairState | null): void {
    this.crosshair = state;
    const n = this.data.length;
    this.events.emit(
      'crosshair:moved',
      state
        ? {
            ...state,
            barIndex: n === 0 ? -1 : Math.max(0, Math.min(n - 1, Math.round(state.index))),
          }
        : null,
    );
    this.invalidate(LayerMask.overlay);
  }

  getCrosshair(): CrosshairState | null {
    return this.crosshair;
  }

  get crosshairSnapper(): CrosshairSnapper | null {
    return this.snapper;
  }

  // ---- plugins ----------------------------------------------------------------------------

  addRenderer(layer: LayerId, renderer: LayerRenderer): () => void {
    const off = this.layers.add(layer, renderer);
    this.invalidate(LayerMask[layer]);
    return () => {
      off();
      this.invalidate(LayerMask[layer]);
    };
  }

  addInteractionHandler(handler: InteractionHandler): () => void {
    this.handlerList = [...this.handlerList, handler].sort((a, b) => b.priority - a.priority);
    return () => {
      this.handlerList = this.handlerList.filter((h) => h !== handler);
    };
  }

  get interactionHandlers(): readonly InteractionHandler[] {
    return this.handlerList;
  }

  addPriceRangeContributor(fn: PriceRangeContributor): () => void {
    this.contributors.push(fn);
    return () => {
      this.contributors = this.contributors.filter((c) => c !== fn);
    };
  }

  getLayout(): ChartLayout {
    return this.layout;
  }

  // ---- rendering --------------------------------------------------------------------------

  invalidate(mask: number | LayerId): void {
    this.loop.invalidate(typeof mask === 'number' ? mask : LayerMask[mask]);
  }

  private resize(width: number, height: number): void {
    const dpr = this.options.hiDpi ? Math.max(1, this.init.runtime.devicePixelRatio()) : 1;
    if (width === this.size.width && height === this.size.height && dpr === this.size.dpr) return;
    this.size = { width, height, dpr };
    this.layers.resize(width, height, dpr);
    this.events.emit('resize', { width, height });
    this.invalidate(ALL_LAYERS);
    this.loop.flush();
  }

  private renderFrame(mask: number): void {
    if (this.size.width <= 0 || this.size.height <= 0) return;
    const animating = this.viewport.step();
    let frame = this.buildFrame();
    if (frame.relayout) {
      frame = this.buildFrame();
      mask = ALL_LAYERS;
    }
    this.layout = frame.frame.layout;
    this.layers.render(animating ? ALL_LAYERS : mask, frame.frame);
    if (animating) this.viewportChanged();
  }

  private buildFrame(): { frame: FrameState; relayout: boolean } {
    return this.frames.build({
      ...this.size,
      data: this.data,
      minMax: this.minMax,
      weights: this.weights,
      series: this.series,
      viewport: this.viewport,
      coords: this.coords,
      options: this.options,
      theme: this.theme,
      symbol: this.symbol,
      timeframe: this.timeframe,
      crosshair: this.crosshair,
      contributors: this.contributors,
      measureText: this.host.measureText,
    });
  }

  private createCoordinates(): ChartCoordinates {
    const vp = this.viewport;
    const ti = this.timeIndex;
    const layout = () => this.layout;
    return {
      get barSpacing() {
        return vp.time.barSpacing;
      },
      get pricePane() {
        return layout().pricePane;
      },
      get plot() {
        return layout().plot;
      },
      timeToIndex: (t) => ti.timeToIndex(t),
      indexToTime: (i) => ti.indexToTime(i),
      indexToX: (i) => vp.time.indexToX(i),
      xToIndex: (x) => vp.time.xToIndex(x),
      timeToX: (t) => vp.time.indexToX(ti.timeToIndex(t)),
      xToTime: (x) => ti.indexToTime(vp.time.xToIndex(x)),
      priceToY: (p) => vp.price.priceToY(p),
      yToPrice: (y) => vp.price.yToPrice(y),
    };
  }

  destroy(): void {
    this.loop.destroy();
    this.router.destroy();
    this.unsubscribeData();
    this.minMax.dispose();
    this.weights.dispose();
    this.series.dispose?.();
    this.layers.destroy();
    this.host.destroy();
    this.events.clear();
  }
}
