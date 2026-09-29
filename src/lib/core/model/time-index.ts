import type { SeriesData } from '../data/series-data';
import { lastLessOrEqual } from '../util/binary-search';

/**
 * Continuous time <-> fractional bar index mapping. Piecewise linear between bars (so a time
 * inside a bar maps inside that bar), extrapolated with the timeframe interval beyond the data.
 */
export class TimeIndex {
  constructor(
    private readonly series: () => SeriesData,
    private readonly intervalMs: () => number,
  ) {}

  timeToIndex(time: number): number {
    const s = this.series();
    const n = s.length;
    const step = this.intervalMs();
    if (n === 0) return 0;
    const t = s.time;
    if (time <= t[0]!) return (time - t[0]!) / step;
    const last = n - 1;
    if (time >= t[last]!) return last + (time - t[last]!) / step;
    const i = lastLessOrEqual(t, n, time);
    const t0 = t[i]!;
    const t1 = t[i + 1]!;
    return i + (time - t0) / (t1 - t0);
  }

  indexToTime(index: number): number {
    const s = this.series();
    const n = s.length;
    const step = this.intervalMs();
    if (n === 0) return index * step;
    const t = s.time;
    if (index <= 0) return t[0]! + index * step;
    const last = n - 1;
    if (index >= last) return t[last]! + (index - last) * step;
    const i = Math.floor(index);
    const f = index - i;
    return t[i]! + f * (t[i + 1]! - t[i]!);
  }
}
