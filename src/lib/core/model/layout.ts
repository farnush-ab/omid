import { ENGINE_CONFIG } from '../config';
import type { Rect } from '../util/geometry';

export interface ChartLayout {
  readonly width: number;
  readonly height: number;
  /** Everything left of the price axis and above the time axis. */
  readonly plot: Rect;
  readonly pricePane: Rect;
  readonly volumePane: Rect | null;
  readonly priceAxis: Rect;
  readonly volumeAxis: Rect | null;
  readonly timeAxis: Rect;
}

export type Region =
  'price-pane' | 'volume-pane' | 'price-axis' | 'volume-axis' | 'time-axis' | 'corner' | 'outside';

export function computeLayout(
  width: number,
  height: number,
  priceAxisWidth: number,
  volumeRatio: number | null,
): ChartLayout {
  const axisW = Math.min(priceAxisWidth, Math.max(0, width - 40));
  const timeH = ENGINE_CONFIG.timeAxis.height;
  const plotW = Math.max(0, width - axisW);
  const plotH = Math.max(0, height - timeH);
  const plot = { x: 0, y: 0, width: plotW, height: plotH };
  if (volumeRatio === null) {
    return {
      width,
      height,
      plot,
      pricePane: plot,
      volumePane: null,
      priceAxis: { x: plotW, y: 0, width: axisW, height: plotH },
      volumeAxis: null,
      timeAxis: { x: 0, y: plotH, width: plotW, height: timeH },
    };
  }
  const volH = Math.round(plotH * volumeRatio);
  const priceH = plotH - volH;
  return {
    width,
    height,
    plot,
    pricePane: { x: 0, y: 0, width: plotW, height: priceH },
    volumePane: { x: 0, y: priceH, width: plotW, height: volH },
    priceAxis: { x: plotW, y: 0, width: axisW, height: priceH },
    volumeAxis: { x: plotW, y: priceH, width: axisW, height: volH },
    timeAxis: { x: 0, y: plotH, width: plotW, height: timeH },
  };
}

export function regionAt(layout: ChartLayout, x: number, y: number): Region {
  const inX = (r: Rect) => x >= r.x && x < r.x + r.width;
  const inY = (r: Rect) => y >= r.y && y < r.y + r.height;
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return 'outside';
  if (inX(layout.plot)) {
    if (inY(layout.pricePane)) return 'price-pane';
    if (layout.volumePane && inY(layout.volumePane)) return 'volume-pane';
    return 'time-axis';
  }
  if (inY(layout.priceAxis)) return 'price-axis';
  if (layout.volumeAxis && inY(layout.volumeAxis)) return 'volume-axis';
  return 'corner';
}
