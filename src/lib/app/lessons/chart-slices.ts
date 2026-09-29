import type { ChartOptions, Theme, TimeframeId } from '@/lib/core';
import { deserializeMany, type DrawingModes, type SerializedDrawing } from '@/lib/drawings';
import {
  datasetKey,
  lerpRecord,
  roundSig,
  type LessonDataProvider,
  type LessonState,
  type SliceBehavior,
  type SliceBehaviors,
} from '@/lib/lessons';
import type { ChartApp } from '../chart-app';

/** Chart size at recording time; the player letterboxes to its aspect ratio. */
export interface StageValue {
  readonly w: number;
  readonly h: number;
}

export interface MarketValue {
  readonly symbol: string;
  readonly timeframe: TimeframeId;
}

/**
 * The visible window: right-edge time (chart coordinates, independent of how much data is
 * loaded), bar spacing (scaled by the stage ratio on other screen sizes) and the logical price
 * range (used when auto-scale is off).
 */
export interface ViewValue {
  /** Dataset key; views of different datasets are never interpolated. */
  readonly k: string;
  readonly r: number;
  readonly b: number;
  readonly lo: number;
  readonly hi: number;
}

/**
 * Teacher pointer as a fraction of the chart size; null when outside the chart. Relative to the
 * stage, not to prices: the pointer stays put while the chart scrolls under it, as it did live.
 * The view is replicated, so the same fraction points at the same candle on any screen.
 */
export interface CursorValue {
  readonly x: number;
  readonly y: number;
}

/** Samples further apart than this are separate positions, not one motion (no interpolation). */
export const MOTION_GAP_MS = 250;

export interface ApplyContext {
  readonly data: LessonDataProvider;
  /** The complete state being applied (slices may depend on each other, e.g. view on stage). */
  readonly state: LessonState;
}

/**
 * One recordable piece of chart state. To make a feature recordable, add a slice: how to read
 * it, which events signal a change, and how to put it back. See docs/LESSONS.md.
 */
export interface ChartSlice<V = unknown> {
  readonly id: string;
  /** 'sample' slices are throttled (high-frequency), 'record' slices are logged on every change. */
  readonly mode: 'record' | 'sample';
  readonly behavior?: SliceBehavior;
  /** Also re-read on the recorder's periodic tick (state that changes without an event). */
  readonly poll?: boolean;
  capture(app: ChartApp): V;
  /**
   * Subscribes to changes. `changed(true)` bypasses sampling throttles: use it for discrete
   * steps (a drawing added or removed, a placement finished) so they land at the exact time.
   */
  watch(app: ChartApp, changed: (immediate?: boolean) => void): () => void;
  apply(app: ChartApp, value: V | undefined, ctx: ApplyContext): void;
}

const round = (v: number) => roundSig(v, 9);

const stage: ChartSlice<StageValue> = {
  id: 'stage',
  mode: 'record',
  capture: (app) => {
    const { width, height } = app.engine.getLayout();
    return { w: Math.round(width), h: Math.round(height) };
  },
  watch: (app, changed) => app.engine.events.on('resize', () => changed()),
  // Consumed by the player UI (letterbox), nothing to do on the chart itself.
  apply: () => {},
};

const market: ChartSlice<MarketValue> = {
  id: 'market',
  mode: 'record',
  capture: (app) => ({
    symbol: app.engine.getSymbol().symbol,
    timeframe: app.engine.getTimeframe().id,
  }),
  // Recorded when bars reach the chart, not when a load starts: that is what the teacher saw.
  watch: (app, changed) =>
    app.engine.events.on('data:changed', ({ reason }) => reason === 'set' && changed()),
  apply: (app, v, { data }) => {
    if (!v) return;
    const cur = app.market.state;
    if (cur.symbol.symbol === v.symbol && cur.timeframe === v.timeframe && app.market.data.length)
      return;
    app.market.show(data.getSymbolInfo(v.symbol), v.timeframe, data.candles(v.symbol, v.timeframe));
  },
};

const options: ChartSlice<ChartOptions> = {
  id: 'options',
  mode: 'record',
  capture: (app) => ({ ...app.engine.getOptions() }),
  watch: (app, changed) => {
    const offs = [
      app.engine.events.on('options:changed', () => changed()),
      // setData(resetView) turns auto-scale back on without an options event.
      app.engine.events.on('data:changed', () => changed()),
    ];
    return () => offs.forEach((off) => off());
  },
  apply: (app, v) => {
    if (v) app.engine.setOptions(v);
  },
};

const theme: ChartSlice<Theme> = {
  id: 'theme',
  mode: 'record',
  capture: (app) => app.engine.getTheme(),
  watch: (app, changed) => app.engine.events.on('theme:changed', () => changed()),
  apply: (app, v) => {
    if (v) app.themes.preview(v);
  },
};

const drawings: ChartSlice<SerializedDrawing[]> = {
  id: 'drawings',
  mode: 'sample',
  capture: (app) => app.drawings.serializeAll(),
  watch: (app, changed) => {
    const d = app.drawings.events;
    let count = app.drawings.store.size;
    const offs = [
      // Adds/removes are exact; live drags (updates) are sampled.
      d.on('drawings:changed', ({ count: next }) => {
        changed(next !== count);
        count = next;
      }),
      d.on('drawing:updated', () => changed()),
    ];
    return () => offs.forEach((off) => off());
  },
  apply: (app, v) => {
    const { drawings: list } = deserializeMany(v ?? [], app.drawings.registry);
    app.drawings.load(list);
  },
};

const modes: ChartSlice<DrawingModes> = {
  id: 'modes',
  mode: 'record',
  capture: (app) => app.drawings.modes,
  watch: (app, changed) => app.drawings.events.on('modes:changed', () => changed()),
  apply: (app, v) => {
    if (v) app.drawings.setModes(v);
  },
};

const tool: ChartSlice<string | null> = {
  id: 'tool',
  mode: 'record',
  capture: (app) => app.drawings.tool,
  watch: (app, changed) => app.drawings.events.on('tool:changed', () => changed()),
  apply: (app, v) => app.drawings.setTool(v ?? null),
};

const selection: ChartSlice<string | null> = {
  id: 'selection',
  mode: 'record',
  capture: (app) => app.drawings.selected?.id ?? null,
  watch: (app, changed) => app.drawings.events.on('selection:changed', () => changed()),
  apply: (app, v) => app.drawings.select(v && app.drawings.store.get(v) ? v : null),
};

/** Moves the points of the same in-progress shape; anything else snaps to the earlier value. */
function lerpPlacement(a: unknown, b: unknown, alpha: number): unknown {
  const pa = a as SerializedDrawing;
  const pb = b as SerializedDrawing;
  if (pa.id !== pb.id || pa.points.length !== pb.points.length) return a;
  return {
    ...pa,
    points: pa.points.map((p, i) => ({
      time: p.time + (pb.points[i]!.time - p.time) * alpha,
      price: p.price + (pb.points[i]!.price - p.price) * alpha,
    })),
  };
}

/**
 * The drawing being placed: the shape following the teacher's pointer between clicks, so a
 * lesson shows how each drawing is made, not only its result. Null when nothing is placed
 * (finished or cancelled — a cancelled placement leaves nothing behind).
 */
const placement: ChartSlice<SerializedDrawing | null> = {
  id: 'placement',
  mode: 'sample',
  behavior: { continuous: true, interpolate: lerpPlacement, maxGapMs: MOTION_GAP_MS },
  capture: (app) => app.drawings.placementPreview,
  watch: (app, changed) =>
    app.drawings.events.on('placement:changed', ({ active }) => changed(!active)),
  apply: (app, v) => app.drawings.showPlacementPreview(v ?? null),
};

const view: ChartSlice<ViewValue> = {
  id: 'view',
  mode: 'sample',
  poll: true, // animated scrolls move the view without events
  behavior: {
    continuous: true,
    maxGapMs: MOTION_GAP_MS,
    interpolate: (a, b, alpha) =>
      (a as ViewValue).k === (b as ViewValue).k ? lerpRecord(a, b, alpha) : a,
  },
  capture: (app) => {
    const e = app.engine;
    const { time, price } = e.viewport;
    return {
      k: datasetKey(e.getSymbol().symbol, e.getTimeframe().id),
      r: round(e.coords.indexToTime(time.rightIndex)),
      b: round(time.barSpacing),
      lo: round(price.min),
      hi: round(price.max),
    };
  },
  watch: (app, changed) => {
    const offs = [
      app.engine.events.on('viewport:changed', () => changed()),
      app.engine.events.on('resize', () => changed()),
    ];
    return () => offs.forEach((off) => off());
  },
  apply: (app, v, { state }) => {
    if (!v) return;
    const e = app.engine;
    const { time, price } = e.viewport;
    const stage = state.stage as StageValue | undefined;
    const width = e.getLayout().width;
    const scale = stage && stage.w > 0 && width > 0 ? width / stage.w : 1;
    time.barSpacing = v.b * scale;
    time.rightIndex = e.coords.timeToIndex(v.r);
    if (!price.autoScale) {
      price.min = v.lo;
      price.max = v.hi;
    }
    e.viewportChanged();
  },
};

const cursor: ChartSlice<CursorValue | null> = {
  id: 'cursor',
  mode: 'sample',
  behavior: { continuous: true, interpolate: lerpRecord, maxGapMs: MOTION_GAP_MS },
  capture: (app) => {
    const c = app.engine.getCrosshair();
    const { width, height } = app.engine.getLayout();
    if (!c || width <= 0 || height <= 0) return null;
    return { x: roundSig(c.x / width, 5), y: roundSig(c.y / height, 5) };
  },
  watch: (app, changed) => app.engine.events.on('crosshair:moved', () => changed()),
  apply: (app, v) => {
    const e = app.engine;
    if (!v) return e.setCrosshair(null);
    const { width, height, pricePane } = e.getLayout();
    const x = v.x * width;
    const y = v.y * height;
    e.setCrosshair({
      x,
      y,
      index: e.coords.xToIndex(x),
      time: e.coords.xToTime(x),
      price: e.coords.yToPrice(y),
      region: y <= pricePane.y + pricePane.height ? 'price-pane' : 'volume-pane',
    });
  },
};

/** Application order matters: data before view, drawings before tool/selection. */
export const CHART_SLICES: readonly ChartSlice[] = [
  stage,
  market,
  options,
  theme,
  drawings,
  modes,
  tool,
  selection,
  placement,
  view,
  cursor,
] as readonly ChartSlice[];

export const CHART_SLICE_BEHAVIORS: SliceBehaviors = Object.fromEntries(
  CHART_SLICES.filter((s) => s.behavior).map((s) => [s.id, s.behavior!]),
);

export function captureChartState(app: ChartApp): LessonState {
  return Object.fromEntries(CHART_SLICES.map((s) => [s.id, s.capture(app)]));
}

/**
 * Puts `state` on the chart. With `prev`, only slices whose value changed are applied (cheap per
 * frame); without, everything is applied (seek, resume, reset). Data changes force the view.
 */
export function applyChartState(
  app: ChartApp,
  state: LessonState,
  prev: LessonState | null,
  ctx: Omit<ApplyContext, 'state'>,
): void {
  const full: ApplyContext = { ...ctx, state };
  let dataChanged = false;
  for (const slice of CHART_SLICES) {
    const v = state[slice.id];
    const force = prev === null || (slice.id === 'view' && dataChanged);
    if (!force && prev[slice.id] === v) continue;
    if (slice.id === 'market' || slice.id === 'options' || slice.id === 'stage') dataChanged = true;
    slice.apply(app, v, full);
  }
}
