import type { Rect } from '../util/geometry';

/** Read-only coordinate facade handed to plugins (drawings, replay picker, series). */
export interface ChartCoordinates {
  readonly barSpacing: number;
  readonly pricePane: Rect;
  readonly plot: Rect;
  timeToIndex(time: number): number;
  indexToTime(index: number): number;
  indexToX(index: number): number;
  xToIndex(x: number): number;
  timeToX(time: number): number;
  xToTime(x: number): number;
  priceToY(price: number): number;
  yToPrice(y: number): number;
}
