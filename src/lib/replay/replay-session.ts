import {
  SeriesData,
  bucketEnd,
  bucketStart,
  firstGreaterOrEqual,
  mergeInto,
  type Candle,
  type TimeframeId,
} from '@/lib/core';

export type StepResult = 'stepped' | 'need-data' | 'end';

/**
 * The data side of a replay. `cursor` is the replay time: everything strictly before it is
 * revealed, nothing at or after it ever reaches `revealed` (the only series the engine sees).
 *
 * - base === chart timeframe: each step reveals the next full bar.
 * - base finer than chart: each step merges one base bar into the forming chart candle, so a
 *   higher-timeframe candle builds up progressively (partial candles).
 */
export class ReplaySession {
  readonly revealed: SeriesData;
  private baseBars: Candle[] = [];
  private baseCursor = 0;
  private baseExhausted = false;

  private constructor(
    private full: SeriesData,
    private chart: TimeframeId,
    private base: TimeframeId,
    private cursorTime: number,
  ) {
    this.revealed = new SeriesData(full.length);
    this.rebuild([]);
  }

  /** Starts with the bar at `barIndex` as the last visible bar. */
  static start(full: SeriesData, chartTf: TimeframeId, barIndex: number): ReplaySession {
    const i = Math.max(0, Math.min(full.length - 1, barIndex));
    return new ReplaySession(full, chartTf, chartTf, bucketEnd(full.time[i]!, chartTf));
  }

  get cursor(): number {
    return this.cursorTime;
  }

  get chartTimeframe(): TimeframeId {
    return this.chart;
  }

  get baseTimeframe(): TimeframeId {
    return this.base;
  }

  get stepsAtBase(): boolean {
    return this.base !== this.chart;
  }

  /** True when nothing more can be revealed. */
  get atEnd(): boolean {
    if (!this.stepsAtBase)
      return (
        firstGreaterOrEqual(this.full.time, this.full.length, this.cursorTime) >= this.full.length
      );
    return this.baseExhausted && this.baseCursor >= this.baseBars.length;
  }

  /** Base bars still buffered ahead of the cursor. */
  get bufferedAhead(): number {
    return this.baseBars.length - this.baseCursor;
  }

  get canFetchMore(): boolean {
    return this.stepsAtBase && !this.baseExhausted;
  }

  /** Time from which more base bars should be fetched. */
  get nextFetchTime(): number {
    const last = this.baseBars[this.baseBars.length - 1];
    return last ? bucketEnd(last.time, this.base) : this.cursorTime;
  }

  /** Appends fetched base bars (ascending). `exhausted` = the provider has nothing newer. */
  addBaseBars(bars: readonly Candle[], exhausted: boolean): void {
    const lastTime = this.baseBars[this.baseBars.length - 1]?.time ?? -Infinity;
    for (const b of bars)
      if (b.time > lastTime && b.time >= this.cursorTime) this.baseBars.push({ ...b });
    this.baseExhausted = exhausted;
  }

  step(): StepResult {
    if (!this.stepsAtBase) {
      const i = firstGreaterOrEqual(this.full.time, this.full.length, this.cursorTime);
      const bar = this.full.bar(i);
      if (!bar) return 'end';
      this.revealed.upsertLast(bar);
      this.cursorTime = bucketEnd(bar.time, this.chart);
      return 'stepped';
    }
    const b = this.baseBars[this.baseCursor];
    if (!b) return this.baseExhausted ? 'end' : 'need-data';
    this.baseCursor += 1;
    this.mergeBase(b);
    this.cursorTime = bucketEnd(b.time, this.base);
    this.compactBuffer();
    return 'stepped';
  }

  /** Reveals everything that is loaded. */
  jumpToEnd(): void {
    const last = this.full.lastIndex;
    if (last < 0) return;
    this.revealed.reset(this.full.toCandles());
    this.cursorTime = bucketEnd(this.full.time[last]!, this.chart);
    this.base = this.chart;
    this.baseBars = [];
    this.baseCursor = 0;
    this.baseExhausted = true;
  }

  /**
   * Switches the displayed timeframe keeping replay time. `baseBars` must cover
   * [partialRange(newChart, newBase).from, …) when the new base is finer than the chart.
   */
  rebase(
    full: SeriesData,
    chartTf: TimeframeId,
    baseTf: TimeframeId,
    baseBars: readonly Candle[],
    exhausted: boolean,
  ): void {
    this.full = full;
    this.chart = chartTf;
    this.base = baseTf;
    this.baseBars = [];
    this.baseCursor = 0;
    this.baseExhausted = exhausted;
    const partial = baseTf === chartTf ? [] : baseBars.filter((b) => b.time < this.cursorTime);
    this.rebuild(partial);
    if (baseTf !== chartTf) this.addBaseBars(baseBars, exhausted);
  }

  /** Start of the forming chart bucket at the cursor (where base data must start), or null. */
  static partialFrom(cursor: number, chartTf: TimeframeId): number | null {
    const start = bucketStart(cursor - 1, chartTf);
    return bucketEnd(start, chartTf) <= cursor ? null : start;
  }

  /** Older history was loaded: prepend it to what is shown. */
  prepend(bars: readonly Candle[]): void {
    const first = this.revealed.time[0] ?? Infinity;
    const older = bars.filter(
      (b) => b.time < first && bucketEnd(b.time, this.chart) <= this.cursorTime,
    );
    if (older.length) this.revealed.prepend(older);
  }

  /** Completed chart bars before the cursor, plus an optional partial from base bars. */
  private rebuild(partialBase: readonly Candle[]): void {
    const out: Candle[] = [];
    for (let i = 0; i < this.full.length; i++) {
      const t = this.full.time[i]!;
      if (bucketEnd(t, this.chart) > this.cursorTime) break;
      out.push(this.full.bar(i)!);
    }
    this.revealed.reset(out);
    for (const b of partialBase) this.mergeBase(b);
  }

  private mergeBase(b: Candle): void {
    const bucket = bucketStart(b.time, this.chart);
    const last = this.revealed.bar(this.revealed.lastIndex);
    if (last && last.time === bucket) this.revealed.upsertLast(mergeInto(last, b));
    else this.revealed.upsertLast({ ...b, time: bucket });
  }

  private compactBuffer(): void {
    if (this.baseCursor > 2000) {
      this.baseBars = this.baseBars.slice(this.baseCursor);
      this.baseCursor = 0;
    }
  }
}
