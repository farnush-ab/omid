import { ENGINE_CONFIG } from '../config';

export type PriceScaleMode = 'linear' | 'log' | 'percent';

const LOG_FLOOR = 1e-12;

/**
 * Maps price <-> y for one pane. Prices are first transformed to a "logical" value
 * (linear: p, log: ln p, percent: (p/base − 1)·100); the visible logical range [min, max]
 * is then mapped linearly onto the pane with top/bottom margins, optionally inverted.
 */
export class PriceScale {
  mode: PriceScaleMode = 'linear';
  inverted = false;
  autoScale = true;
  top = 0;
  height = 0;
  marginTop: number = ENGINE_CONFIG.priceMargins.top;
  marginBottom: number = ENGINE_CONFIG.priceMargins.bottom;
  /** Base price for percent mode (first visible close). */
  base = 1;
  /** Visible logical range. */
  min = 0;
  max = 1;

  toLogical(price: number): number {
    switch (this.mode) {
      case 'linear':
        return price;
      case 'log':
        return Math.log(Math.max(price, LOG_FLOOR));
      case 'percent':
        return (price / this.base - 1) * 100;
    }
  }

  fromLogical(value: number): number {
    switch (this.mode) {
      case 'linear':
        return value;
      case 'log':
        return Math.exp(value);
      case 'percent':
        return (value / 100 + 1) * this.base;
    }
  }

  private get innerTop(): number {
    return this.top + this.height * this.marginTop;
  }

  private get innerHeight(): number {
    return Math.max(1, this.height * (1 - this.marginTop - this.marginBottom));
  }

  logicalToY(l: number): number {
    const span = this.max - this.min || 1;
    const y = this.innerTop + ((this.max - l) / span) * this.innerHeight;
    return this.inverted ? this.top + this.height - (y - this.top) : y;
  }

  yToLogical(y: number): number {
    const yy = this.inverted ? this.top + this.height - (y - this.top) : y;
    const span = this.max - this.min || 1;
    return this.max - ((yy - this.innerTop) / this.innerHeight) * span;
  }

  priceToY(price: number): number {
    return this.logicalToY(this.toLogical(price));
  }

  yToPrice(y: number): number {
    return this.fromLogical(this.yToLogical(y));
  }

  /** Sets the visible range from price extents (auto-scale). */
  fitPrices(minPrice: number, maxPrice: number): void {
    let lo = this.toLogical(minPrice);
    let hi = this.toLogical(maxPrice);
    if (hi - lo < 1e-12) {
      const pad = Math.abs(hi) * 0.01 || 1;
      lo -= pad;
      hi += pad;
    }
    this.min = lo;
    this.max = hi;
  }

  /** Changes the mode while keeping the same visible prices. */
  setMode(mode: PriceScaleMode): void {
    if (mode === this.mode) return;
    const hiP = this.fromLogical(this.max);
    const loP = this.fromLogical(this.min);
    this.mode = mode;
    this.fitPrices(Math.max(loP, mode === 'log' ? LOG_FLOOR : -Infinity), hiP);
  }

  /** Re-bases percent mode, keeping visible prices when not auto-scaling. */
  setBase(base: number): void {
    if (!(base > 0) || base === this.base) return;
    if (this.mode === 'percent') {
      const loP = this.fromLogical(this.min);
      const hiP = this.fromLogical(this.max);
      this.base = base;
      this.min = this.toLogical(loP);
      this.max = this.toLogical(hiP);
    } else {
      this.base = base;
    }
  }

  /** Vertical pan in pixels (manual scale only). */
  scrollBy(dyPx: number): void {
    const perPx = (this.max - this.min) / this.innerHeight;
    const d = dyPx * perPx * (this.inverted ? -1 : 1);
    this.min += d;
    this.max += d;
  }

  /** Scale around the centre; factor > 1 zooms in (smaller range). */
  zoom(factor: number): void {
    const mid = (this.min + this.max) / 2;
    const half = (this.max - this.min) / 2 / factor;
    this.min = mid - half;
    this.max = mid + half;
  }

  /** Logical units per pixel. */
  get unitsPerPixel(): number {
    return (this.max - this.min) / this.innerHeight;
  }
}
