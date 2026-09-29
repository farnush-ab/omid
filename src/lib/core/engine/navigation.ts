import type { ChartPointerEvent, NavigationTarget, PointerLike } from '../interaction/types';
import { regionAt, type Region } from '../model/layout';
import type { ChartEngine } from './chart-engine';
import type { DomHost } from './dom-host';

const AXIS_CURSORS: Partial<Record<Region, string>> = {
  'price-axis': 'ns-resize',
  'volume-axis': 'ns-resize',
  'time-axis': 'ew-resize',
};

/** Adapts the engine to the PointerRouter's NavigationTarget port. */
export function createNavigationTarget(engine: ChartEngine, host: DomHost): NavigationTarget {
  const vp = engine.viewport;

  const toChartEvent = (x: number, y: number, src: PointerLike): ChartPointerEvent => {
    const index = vp.time.xToIndex(x);
    const pt = src.pointerType;
    return {
      x,
      y,
      clientX: src.clientX,
      clientY: src.clientY,
      region: regionAt(engine.getLayout(), x, y),
      pointerType: pt === 'touch' || pt === 'pen' ? pt : 'mouse',
      button: src.button ?? 0,
      shift: src.shiftKey,
      ctrl: src.ctrlKey || src.metaKey,
      alt: src.altKey,
      index,
      time: engine.coords.indexToTime(index),
      price: vp.price.yToPrice(y),
    };
  };

  return {
    regionAt: (x, y) => regionAt(engine.getLayout(), x, y),
    toChartEvent,
    handlers: () => engine.interactionHandlers,
    panBy(dx, dy) {
      vp.panBy(dx, dy);
      engine.viewportChanged();
    },
    zoomTimeAt(x, factor) {
      vp.zoomTimeAt(x, factor);
      engine.viewportChanged();
    },
    scalePrice(dy) {
      vp.scalePrice(dy);
      engine.syncAutoScaleOption();
      engine.viewportChanged();
    },
    scaleTime(dx) {
      vp.scaleTime(dx);
      engine.viewportChanged();
    },
    resetPriceScale: () => engine.resetPriceScale(),
    resetTimeScale: () => engine.resetTimeScale(),
    setCrosshair(x, y, e) {
      const region = regionAt(engine.getLayout(), x, y);
      if (region !== 'price-pane' && region !== 'volume-pane') return engine.setCrosshair(null);
      const index = Math.round(vp.time.xToIndex(x));
      let price = vp.price.yToPrice(y);
      let yy = y;
      const snap = region === 'price-pane' ? engine.crosshairSnapper?.(index, price, y) : null;
      if (snap !== null && snap !== undefined) {
        price = snap;
        yy = vp.price.priceToY(snap);
      }
      engine.setCrosshair({
        x,
        y: yy,
        index,
        time: e?.time ?? engine.coords.indexToTime(index),
        price,
        region,
      });
    },
    clearCrosshair: () => {
      if (engine.getCrosshair()) engine.setCrosshair(null);
    },
    setCursor: (c) => host.setCursor(c),
    defaultCursor: (region) =>
      AXIS_CURSORS[region] ??
      (engine.getOptions().crosshairMode === 'arrow' ? 'default' : 'crosshair'),
    contextMenu: (e) =>
      engine.events.emit('contextmenu', {
        x: e.x,
        y: e.y,
        clientX: e.clientX,
        clientY: e.clientY,
        time: e.time,
        price: e.price,
      }),
    gestureEnd: () => engine.invalidate('overlay'),
  };
}
