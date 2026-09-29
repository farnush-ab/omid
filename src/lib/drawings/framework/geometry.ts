import type { Point } from '@/lib/core';
import type { ChartPoint, DrawingContext } from './types';

export function toPixel(p: ChartPoint, dc: DrawingContext): Point {
  return { x: dc.coords.timeToX(p.time), y: dc.coords.priceToY(p.price) };
}

/** Pixel -> chart point. With `snapToBars` the time lands exactly on the nearest bar. */
export function fromPixel(
  x: number,
  y: number,
  dc: DrawingContext,
  snapToBars: boolean,
): ChartPoint {
  const index = dc.coords.xToIndex(x);
  return {
    time: dc.coords.indexToTime(snapToBars ? Math.round(index) : index),
    price: dc.coords.yToPrice(y),
  };
}

/** Moves a chart point by whole bars and pixels (keeps shapes intact across scale types). */
export function shiftPoint(
  p: ChartPoint,
  dBars: number,
  dyPx: number,
  dc: DrawingContext,
): ChartPoint {
  const index = dc.coords.timeToIndex(p.time) + dBars;
  return {
    time: dc.coords.indexToTime(index),
    price: dc.coords.yToPrice(dc.coords.priceToY(p.price) + dyPx),
  };
}

/** Bars between two times on the current timeframe (fractional). */
export function barsBetween(a: number, b: number, dc: DrawingContext): number {
  return dc.coords.timeToIndex(b) - dc.coords.timeToIndex(a);
}
