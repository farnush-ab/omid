import {
  LESSON_TIMELINE_VERSION,
  type LessonDataset,
  type LessonState,
  type LessonTimeline,
  type SliceId,
  type TimelineOp,
} from './types';

export interface RecorderClock {
  now(): number;
}

export interface TimelineRecorderOptions {
  /** Minimum spacing (ms) between samples of a throttled slice. */
  readonly sampleIntervalMs?: number;
}

/**
 * Append-only op log for one recording. Discrete values are de-duplicated; slices marked as
 * throttled (cursor, view) keep at most one sample per interval, the latest value winning, and
 * flush on the next sample, on `flush()` or before any other op so the final position is kept.
 */
export class TimelineRecorder {
  private readonly ops: TimelineOp[] = [];
  private readonly lastJson = new Map<SliceId, string>();
  private readonly lastSampleAt = new Map<SliceId, number>();
  private readonly pending = new Map<SliceId, unknown>();
  private readonly interval: number;
  private initialState: LessonState = {};

  constructor(
    private readonly clock: RecorderClock,
    opts: TimelineRecorderOptions = {},
  ) {
    this.interval = opts.sampleIntervalMs ?? 40;
  }

  begin(initial: LessonState): void {
    this.initialState = initial;
    for (const [s, v] of Object.entries(initial)) this.lastJson.set(s, JSON.stringify(v));
  }

  get initial(): LessonState {
    return this.initialState;
  }

  get length(): number {
    return this.ops.length;
  }

  /** Ops from index `from` (autosave appends segments). */
  opsFrom(from: number): TimelineOp[] {
    return this.ops.slice(from);
  }

  /** Records a full value for `slice` unless it equals the last one. */
  record(slice: SliceId, value: unknown): void {
    const json = JSON.stringify(value);
    if (this.lastJson.get(slice) === json) return;
    this.flush();
    this.lastJson.set(slice, json);
    this.ops.push({ t: this.clock.now(), s: slice, v: value });
  }

  /** Records a throttled sample (continuous slices). */
  sample(slice: SliceId, value: unknown): void {
    const t = this.clock.now();
    const last = this.lastSampleAt.get(slice);
    if (last !== undefined && t - last < this.interval) {
      this.pending.set(slice, value);
      return;
    }
    this.pending.delete(slice);
    this.writeSample(slice, value, t);
  }

  /** Records a patch applied by the slice's `reduce` (not de-duplicated). */
  patch(slice: SliceId, value: unknown): void {
    this.flush();
    this.lastJson.delete(slice);
    this.ops.push({ t: this.clock.now(), s: slice, v: value, p: 1 });
  }

  /** Writes pending throttled samples at the current time. */
  flush(): void {
    if (this.pending.size === 0) return;
    const t = this.clock.now();
    for (const [slice, value] of [...this.pending]) this.writeSample(slice, value, t);
    this.pending.clear();
  }

  private writeSample(slice: SliceId, value: unknown, t: number): void {
    const json = JSON.stringify(value);
    if (this.lastJson.get(slice) === json) return;
    this.lastJson.set(slice, json);
    this.lastSampleAt.set(slice, t);
    this.ops.push({ t, s: slice, v: value });
  }

  finish(duration: number, datasets: readonly LessonDataset[]): LessonTimeline {
    this.flush();
    const end = Math.max(duration, this.ops.at(-1)?.t ?? 0);
    return {
      version: LESSON_TIMELINE_VERSION,
      duration: end,
      initial: this.initialState,
      ops: [...this.ops],
      datasets: [...datasets],
    };
  }
}
