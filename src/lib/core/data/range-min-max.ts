import type { SeriesChange, SeriesData } from './series-data';

const BLOCK = 64;

export interface MinMax {
  min: number;
  max: number;
}

/**
 * Block index over (low, high, volume) so visible-range extents cost O(n/64 + 128)
 * instead of O(n). Updates incrementally for appends / forming-candle updates.
 */
export class RangeMinMax {
  private blockLow = new Float64Array(0);
  private blockHigh = new Float64Array(0);
  private blockVol = new Float64Array(0);
  private dirtyFrom = 0;
  private readonly unsubscribe: () => void;

  constructor(private readonly series: SeriesData) {
    this.unsubscribe = series.onChange((c) => this.onChange(c));
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** Min low / max high over bar indices [from, to] (inclusive, clamped). */
  priceRange(from: number, to: number): MinMax | null {
    return this.query(from, to, this.series.low, this.series.high, true);
  }

  volumeMax(from: number, to: number): number {
    const r = this.query(from, to, this.series.volume, this.series.volume, false);
    return r ? r.max : 0;
  }

  private onChange(c: SeriesChange): void {
    const from = c.kind === 'update' ? c.fromIndex : 0;
    this.dirtyFrom = Math.min(this.dirtyFrom, from);
  }

  private sync(): void {
    const n = this.series.length;
    const blocks = Math.ceil(n / BLOCK);
    if (this.blockLow.length < blocks) {
      const cap = Math.max(16, Math.ceil(blocks * 1.5));
      const grow = (a: Float64Array) => {
        const next = new Float64Array(cap);
        next.set(a);
        return next;
      };
      this.blockLow = grow(this.blockLow);
      this.blockHigh = grow(this.blockHigh);
      this.blockVol = grow(this.blockVol);
    }
    const { low, high, volume } = this.series;
    for (let b = Math.floor(this.dirtyFrom / BLOCK); b < blocks; b++) {
      let lo = Infinity;
      let hi = -Infinity;
      let vo = 0;
      const end = Math.min(n, (b + 1) * BLOCK);
      for (let i = b * BLOCK; i < end; i++) {
        if (low[i]! < lo) lo = low[i]!;
        if (high[i]! > hi) hi = high[i]!;
        if (volume[i]! > vo) vo = volume[i]!;
      }
      this.blockLow[b] = lo;
      this.blockHigh[b] = hi;
      this.blockVol[b] = vo;
    }
    this.dirtyFrom = n;
  }

  private query(
    from: number,
    to: number,
    lowCol: Float64Array,
    highCol: Float64Array,
    isPrice: boolean,
  ): MinMax | null {
    const n = this.series.length;
    const a = Math.max(0, Math.floor(from));
    const b = Math.min(n - 1, Math.ceil(to));
    if (n === 0 || a > b) return null;
    if (this.dirtyFrom < n) this.sync();
    let min = Infinity;
    let max = -Infinity;
    const scan = (s: number, e: number) => {
      for (let i = s; i <= e; i++) {
        if (lowCol[i]! < min) min = lowCol[i]!;
        if (highCol[i]! > max) max = highCol[i]!;
      }
    };
    const ba = Math.ceil(a / BLOCK);
    const bb = Math.floor((b + 1) / BLOCK) - 1;
    if (ba > bb) {
      scan(a, b);
    } else {
      scan(a, ba * BLOCK - 1);
      for (let k = ba; k <= bb; k++) {
        const lo = isPrice ? this.blockLow[k]! : this.blockVol[k]!;
        const hi = isPrice ? this.blockHigh[k]! : this.blockVol[k]!;
        if (lo < min) min = lo;
        if (hi > max) max = hi;
      }
      scan((bb + 1) * BLOCK, b);
    }
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
  }
}
