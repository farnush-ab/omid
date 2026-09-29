import { ENGINE_CONFIG } from '../config';
import type { Clock } from '../contracts/runtime';
import { PriceScale } from '../scales/price-scale';
import { TimeScale } from '../scales/time-scale';
import { clamp } from '../util/math';

interface Animation {
  from: number;
  to: number;
  start: number;
  duration: number;
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Owns the time and price scales and every viewport operation (pan, zoom, axis scaling,
 * resets, animated scroll). Knows nothing about rendering or DOM.
 */
export class ViewportController {
  readonly time = new TimeScale();
  readonly price = new PriceScale();
  private length = 0;
  private rightMargin: number = ENGINE_CONFIG.rightMarginBars;
  private lockRatio = false;
  private animation: Animation | null = null;

  constructor(private readonly clock: Clock) {}

  setDataLength(length: number): void {
    this.length = length;
    this.time.clamp(length);
  }

  setRightMargin(bars: number): void {
    this.rightMargin = Math.max(0, bars);
  }

  setLockRatio(lock: boolean): void {
    this.lockRatio = lock;
  }

  get atLatest(): boolean {
    return this.time.rightIndex >= this.length - 1 && this.time.leftIndex <= this.length - 1;
  }

  /** Default view: default bar spacing, last bar `rightMargin` bars from the right edge. */
  resetTime(): void {
    this.animation = null;
    this.time.setBarSpacing(ENGINE_CONFIG.barSpacing.default);
    this.time.rightIndex = this.length - 1 + this.rightMargin;
    this.time.clamp(this.length);
  }

  scrollToLatest(animated: boolean): void {
    const target = this.length - 1 + this.rightMargin;
    if (!animated) {
      this.animation = null;
      this.time.rightIndex = target;
      return;
    }
    this.animation = {
      from: this.time.rightIndex,
      to: target,
      start: this.clock.now(),
      duration: ENGINE_CONFIG.animation.scrollMs,
    };
  }

  /** Advances any running animation; returns true while it is still running. */
  step(): boolean {
    const a = this.animation;
    if (!a) return false;
    const t = clamp((this.clock.now() - a.start) / a.duration, 0, 1);
    this.time.rightIndex = a.from + (a.to - a.from) * easeOutCubic(t);
    if (t >= 1) this.animation = null;
    return this.animation !== null;
  }

  /**
   * Drag-pan in pixels: the content follows the pointer (drag down moves the chart down).
   * Vertical pan only applies when auto-scale is off.
   */
  panBy(dx: number, dy: number): void {
    this.animation = null;
    this.time.scrollBy(dx);
    this.time.clamp(this.length);
    if (!this.price.autoScale && dy !== 0) this.price.scrollBy(dy);
  }

  scrollBars(bars: number): void {
    this.animation = null;
    this.time.rightIndex += bars;
    this.time.clamp(this.length);
  }

  zoomTimeAt(x: number, factor: number): void {
    this.animation = null;
    const before = this.time.barSpacing;
    this.time.zoomAt(x, factor);
    this.time.clamp(this.length);
    if (this.lockRatio && !this.price.autoScale) this.price.zoom(this.time.barSpacing / before);
  }

  /** Dragging the time axis: right = zoom out, anchored at the right edge. */
  scaleTime(dxPx: number): void {
    this.zoomTimeAt(this.time.width, Math.exp(-dxPx * ENGINE_CONFIG.zoom.axisDragSensitivity));
  }

  /** Dragging the price axis: down = compress. Turns auto-scale off (caller syncs options). */
  scalePrice(dyPx: number): void {
    this.price.autoScale = false;
    this.price.zoom(Math.exp(-dyPx * ENGINE_CONFIG.zoom.axisDragSensitivity));
  }

  /** Keeps the view anchored when `count` bars are inserted before index 0. */
  onPrepend(count: number): void {
    this.time.rightIndex += count;
    if (this.animation) {
      this.animation.from += count;
      this.animation.to += count;
    }
  }

  /** Keeps following the latest bar when bars are appended while the last bar is visible. */
  onAppend(previousLength: number, newLength: number, wasAtLatest: boolean): void {
    const added = newLength - previousLength;
    if (added > 0 && wasAtLatest) this.time.rightIndex += added;
    this.setDataLength(newLength);
  }
}
