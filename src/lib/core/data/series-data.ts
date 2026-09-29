import type { Candle } from './candle';

export type SeriesChange =
  | { readonly kind: 'reset' }
  | { readonly kind: 'prepend'; readonly count: number }
  /** Bars from `fromIndex` to the end were modified or appended. */
  | { readonly kind: 'update'; readonly fromIndex: number };

type Listener = (change: SeriesChange) => void;

const MIN_CAPACITY = 64;

/**
 * Columnar OHLCV storage in Float64Arrays. Arrays may be larger than `length` (capacity);
 * readers must only access indices < length. Appends are amortised O(1).
 */
export class SeriesData {
  time: Float64Array;
  open: Float64Array;
  high: Float64Array;
  low: Float64Array;
  close: Float64Array;
  volume: Float64Array;
  private len = 0;
  private listeners = new Set<Listener>();

  constructor(capacity = MIN_CAPACITY) {
    const cap = Math.max(MIN_CAPACITY, capacity);
    this.time = new Float64Array(cap);
    this.open = new Float64Array(cap);
    this.high = new Float64Array(cap);
    this.low = new Float64Array(cap);
    this.close = new Float64Array(cap);
    this.volume = new Float64Array(cap);
  }

  static fromCandles(candles: readonly Candle[]): SeriesData {
    const s = new SeriesData(candles.length);
    s.writeRange(0, candles);
    s.len = candles.length;
    return s;
  }

  get length(): number {
    return this.len;
  }

  get lastIndex(): number {
    return this.len - 1;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  bar(i: number): Candle | null {
    if (i < 0 || i >= this.len) return null;
    return {
      time: this.time[i]!,
      open: this.open[i]!,
      high: this.high[i]!,
      low: this.low[i]!,
      close: this.close[i]!,
      volume: this.volume[i]!,
    };
  }

  toCandles(from = 0, to = this.len - 1): Candle[] {
    const out: Candle[] = [];
    for (let i = Math.max(0, from); i <= Math.min(to, this.len - 1); i++) out.push(this.bar(i)!);
    return out;
  }

  /** Replaces all bars. */
  reset(candles: readonly Candle[]): void {
    this.ensureCapacity(candles.length, false);
    this.writeRange(0, candles);
    this.len = candles.length;
    this.emit({ kind: 'reset' });
  }

  /** Inserts older bars before index 0 (lazy history). */
  prepend(candles: readonly Candle[]): void {
    const n = candles.length;
    if (n === 0) return;
    const newLen = this.len + n;
    const cap = Math.max(MIN_CAPACITY, Math.ceil(newLen * 1.25));
    for (const key of COLUMNS) {
      const next = new Float64Array(cap);
      next.set(this[key].subarray(0, this.len), n);
      this[key] = next;
    }
    this.writeRange(0, candles);
    this.len = newLen;
    this.emit({ kind: 'prepend', count: n });
  }

  /** Appends a bar, or replaces the last one when it has the same time (forming candle). */
  upsertLast(bar: Candle): void {
    const last = this.len - 1;
    if (last >= 0 && this.time[last] === bar.time) {
      this.writeBar(last, bar);
      this.emit({ kind: 'update', fromIndex: last });
      return;
    }
    this.ensureCapacity(this.len + 1, true);
    this.writeBar(this.len, bar);
    this.len += 1;
    this.emit({ kind: 'update', fromIndex: this.len - 1 });
  }

  /** Drops bars from `newLength` onwards. */
  truncate(newLength: number): void {
    if (newLength >= this.len) return;
    this.len = Math.max(0, newLength);
    this.emit({ kind: 'update', fromIndex: this.len });
  }

  clone(from = 0, to = this.len - 1): SeriesData {
    return SeriesData.fromCandles(this.toCandles(from, to));
  }

  private ensureCapacity(needed: number, keep: boolean): void {
    if (needed <= this.time.length) return;
    const cap = Math.max(MIN_CAPACITY, Math.ceil(needed * 1.5));
    for (const key of COLUMNS) {
      const next = new Float64Array(cap);
      if (keep) next.set(this[key].subarray(0, this.len));
      this[key] = next;
    }
  }

  private writeRange(offset: number, candles: readonly Candle[]): void {
    for (let i = 0; i < candles.length; i++) this.writeBar(offset + i, candles[i]!);
  }

  private writeBar(i: number, b: Candle): void {
    this.time[i] = b.time;
    this.open[i] = b.open;
    this.high[i] = b.high;
    this.low[i] = b.low;
    this.close[i] = b.close;
    this.volume[i] = b.volume;
  }

  private emit(change: SeriesChange): void {
    for (const l of this.listeners) l(change);
  }
}

const COLUMNS = ['time', 'open', 'high', 'low', 'close', 'volume'] as const;
