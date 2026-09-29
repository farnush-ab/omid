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
  /** Ascending bar indices per weight, maintained incrementally. */
  private readonly levels: number[][] = Array.from({ length: MAX_WEIGHT + 1 }, () => []);

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
    for (const list of this.levels) {
      while (list.length > 0 && list[list.length - 1]! >= this.validUpTo) list.pop();
    }
    const t = this.series.time;
    for (let i = this.validUpTo; i < n; i++) {
      const w = weightBetween(i > 0 ? t[i - 1]! : null, t[i]!, this.utc);
      this.weights[i] = w;
      this.levels[w]!.push(i);
    }
    this.validUpTo = n;
  }

  /**
   * Selects labelled ticks for bars [from, to]: most important first, at least `minSpacing`
   * apart. Only walks the per-weight index lists inside the range, stopping once full.
   */
  ticks(from: number, to: number, indexToX: (i: number) => number, minSpacing: number): TimeTick[] {
    this.sync();
    const xs: number[] = [];
    const accepted: TimeTick[] = [];
    const lo = Math.max(0, from);
    const hi = Math.min(to, this.series.length - 1);
    const xLo = indexToX(lo);
    const xHi = indexToX(hi);
    const capacity = Math.floor(Math.abs(xHi - xLo) / minSpacing) + 2;
    for (
      let w = MAX_WEIGHT;
      w >= 0 && accepted.length < capacity && hasRoom(xs, xLo, xHi, minSpacing);
      w--
    ) {
      const list = this.levels[w]!;
      for (let j = lowerBound(list, lo); j < list.length && accepted.length < capacity; j++) {
        const i = list[j]!;
        if (i > hi) break;
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

/** Whether any position in [xLo, xHi] is still >= minSpacing away from every accepted tick. */
function hasRoom(sorted: readonly number[], xLo: number, xHi: number, minSpacing: number): boolean {
  if (sorted.length === 0) return true;
  if (sorted[0]! - xLo >= minSpacing || xHi - sorted[sorted.length - 1]! >= minSpacing) return true;
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i]! - sorted[i - 1]! >= minSpacing * 2) return true;
  return false;
}

function lowerBound(list: readonly number[], value: number): number {
  let a = 0;
  let b = list.length;
  while (a < b) {
    const m = (a + b) >>> 1;
    if (list[m]! < value) a = m + 1;
    else b = m;
  }
  return a;
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
