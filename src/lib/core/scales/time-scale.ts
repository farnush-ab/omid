import { ENGINE_CONFIG } from '../config';
import { clamp } from '../util/math';

const { barSpacing: BS, minVisibleBars } = ENGINE_CONFIG;

/**
 * Maps (fractional) bar index <-> x inside the plot. `rightIndex` is the index located at the
 * plot's right edge; values beyond the last bar produce TradingView's "future space".
 */
export class TimeScale {
  width = 0;
  barSpacing: number = BS.default;
  rightIndex = 0;

  indexToX(index: number): number {
    return this.width + (index - this.rightIndex) * this.barSpacing;
  }

  xToIndex(x: number): number {
    return this.rightIndex - (this.width - x) / this.barSpacing;
  }

  /** Nearest whole bar index at x. */
  xToBarIndex(x: number): number {
    return Math.round(this.xToIndex(x));
  }

  get leftIndex(): number {
    return this.xToIndex(0);
  }

  get visibleBars(): number {
    return this.width / this.barSpacing;
  }

  /** Inclusive integer range of indices that intersect the plot, clamped to [0, length). */
  visibleRange(length: number): { from: number; to: number } {
    return {
      from: Math.max(0, Math.floor(this.leftIndex) - 1),
      to: Math.min(length - 1, Math.ceil(this.rightIndex) + 1),
    };
  }

  scrollBy(dxPx: number): void {
    this.rightIndex -= dxPx / this.barSpacing;
  }

  /** Zoom keeping the bar under `anchorX` fixed. factor > 1 zooms in. */
  zoomAt(anchorX: number, factor: number): void {
    const anchorIndex = this.xToIndex(anchorX);
    this.barSpacing = clamp(this.barSpacing * factor, BS.min, BS.max);
    this.rightIndex = anchorIndex + (this.width - anchorX) / this.barSpacing;
  }

  setBarSpacing(value: number): void {
    this.barSpacing = clamp(value, BS.min, BS.max);
  }

  /** Keeps at least a few bars of data on screen. */
  clamp(length: number): void {
    if (length <= 0) return;
    const visible = this.visibleBars;
    const minRight = Math.min(length - 1, minVisibleBars - 1) + 0.5;
    const maxRight = length - 1 + Math.max(minVisibleBars, visible - minVisibleBars);
    this.rightIndex = clamp(this.rightIndex, minRight, Math.max(minRight, maxRight));
  }
}
