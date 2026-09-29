import type { SeriesChange, SeriesData } from '../data/series-data';
import { calendarParts, monthName, formatTimeOfDay } from '../util/format';

export const WEIGHT = { year: 10, month: 9, day: 8 } as const;
/** Minute-of-day boundaries, from coarse to fine, mapped to weights 7..1. */
const INTRADAY_LEVELS: ReadonlyArray<[number, number]> = [
  [720, 7],
  [360, 6],
  [180, 5],
  [60, 4],
  [30, 3],
  [15, 2],
  [5, 1],
];
const MAX_WEIGHT = WEIGHT.year;

export interface TimeTick {
  readonly x: number;
  readonly index: number;
  readonly label: string;
  readonly weight: number;
}

function weightBetween(prev: number | null, cur: number, utc: boolean): number {
  const c = calendarParts(cur, utc);
  const cMin = c.hours * 60 + c.minutes;
  if (prev === null) {
    if (c.month === 0 && c.day === 1 && cMin === 0) return WEIGHT.year;
    if (c.day === 1 && cMin === 0) return WEIGHT.month;
    if (cMin === 0) return WEIGHT.day;
    for (const [div, w] of INTRADAY_LEVELS) if (cMin % div === 0) return w;
    return 0;
  }
  const p = calendarParts(prev, utc);
  if (p.year !== c.year) return WEIGHT.year;
  if (p.month !== c.month) return WEIGHT.month;
  if (p.day !== c.day) return WEIGHT.day;
  const pMin = p.hours * 60 + p.minutes;
  for (const [div, w] of INTRADAY_LEVELS) {
    if (Math.floor(pMin / div) !== Math.floor(cMin / div)) return w;
  }
  return 0;
}

export function tickLabel(time: number, weight: number, utc: boolean): string {
  const p = calendarParts(time, utc);
  if (weight >= WEIGHT.year) return String(p.year);
  if (weight === WEIGHT.month) return monthName(p.month);
  if (weight === WEIGHT.day) return String(p.day);
  return formatTimeOfDay(time, utc);
}

/**
 * Per-bar "importance" of each bar's time (year > month > day > 12h > … > 5m), cached per data
 * change. Tick selection then picks the most important bars that fit on screen.
 */
export class TimeWeights {
  private weights = new Uint8Array(0);
  private validUpTo = 0;
  private utc = false;
  private readonly unsubscribe: () => void;
  private readonly buckets: number[][] = Array.from({ length: MAX_WEIGHT + 1 }, () => []);

  constructor(private readonly series: SeriesData) {
    this.unsubscribe = series.onChange((c: SeriesChange) => {
      this.validUpTo = c.kind === 'update' ? Math.min(this.validUpTo, c.fromIndex) : 0;
    });
  }

  dispose(): void {
    this.unsubscribe();
  }

  setUtc(utc: boolean): void {
    if (utc !== this.utc) {
      this.utc = utc;
      this.validUpTo = 0;
    }
  }

  weightAt(i: number): number {
    this.sync();
    return this.weights[i] ?? 0;
  }

  private sync(): void {
    const n = this.series.length;
    if (this.validUpTo >= n) return;
    if (this.weights.length < n) {
      const next = new Uint8Array(Math.ceil(n * 1.5));
      next.set(this.weights.subarray(0, this.validUpTo));
      this.weights = next;
    }
    const t = this.series.time;
    for (let i = this.validUpTo; i < n; i++) {
      this.weights[i] = weightBetween(i > 0 ? t[i - 1]! : null, t[i]!, this.utc);
    }
    this.validUpTo = n;
  }

  /** Selects labelled ticks for bars [from, to] given an index->x mapping. */
  ticks(from: number, to: number, indexToX: (i: number) => number, minSpacing: number): TimeTick[] {
    this.sync();
    for (const b of this.buckets) b.length = 0;
    for (let i = Math.max(0, from); i <= to && i < this.series.length; i++) {
      this.buckets[this.weights[i]!]!.push(i);
    }
    const xs: number[] = [];
    const accepted: TimeTick[] = [];
    for (let w = MAX_WEIGHT; w >= 0; w--) {
      for (const i of this.buckets[w]!) {
        const x = indexToX(i);
        if (!fits(xs, x, minSpacing)) continue;
        insertSorted(xs, x);
        accepted.push({
          x,
          index: i,
          weight: w,
          label: tickLabel(this.series.time[i]!, w, this.utc),
        });
      }
    }
    return accepted.sort((a, b) => a.x - b.x);
  }
}

function fits(sorted: number[], x: number, spacing: number): boolean {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  const right = sorted[lo];
  const left = sorted[lo - 1];
  return (
    (right === undefined || right - x >= spacing) && (left === undefined || x - left >= spacing)
  );
}

function insertSorted(sorted: number[], x: number): void {
  let i = sorted.length;
  while (i > 0 && sorted[i - 1]! > x) i--;
  sorted.splice(i, 0, x);
}
