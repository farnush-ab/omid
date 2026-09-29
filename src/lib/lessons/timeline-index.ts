import type { LessonState, LessonTimeline, SliceBehaviors, SliceId, TimelineOp } from './types';

/** Spacing of in-memory snapshots; a seek replays at most this much of the log. */
export const KEYFRAME_INTERVAL_MS = 2000;

interface Keyframe {
  /** Index of the first op NOT folded into `state`. */
  readonly opIndex: number;
  readonly state: LessonState;
}

/** First index in `ops` whose t > time (ops sorted by t). */
function upperBound(ops: readonly TimelineOp[], time: number): number {
  let lo = 0;
  let hi = ops.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ops[mid]!.t <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function lastAtOrBefore(times: readonly number[], time: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid]! <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/**
 * Reconstructs the lesson state at any time: nearest keyframe + fold of the following ops.
 * Continuous slices are resolved from their own sample streams and interpolated. Built once per
 * loaded lesson; the timeline itself is never mutated (student play cannot touch it).
 */
export class TimelineIndex {
  private readonly keyframes: Keyframe[] = [];
  private readonly streams = new Map<SliceId, { times: number[]; values: unknown[] }>();

  constructor(
    readonly timeline: LessonTimeline,
    private readonly behaviors: SliceBehaviors,
    interval = KEYFRAME_INTERVAL_MS,
  ) {
    const ops = timeline.ops;
    for (let i = 1; i < ops.length; i++) {
      if (ops[i]!.t < ops[i - 1]!.t) throw new Error('Timeline ops are not sorted by time');
    }
    let state: Record<SliceId, unknown> = { ...timeline.initial };
    let nextKey = 0;
    for (let i = 0; i <= ops.length; i++) {
      const op = ops[i];
      if (!op || op.t >= nextKey) {
        this.keyframes.push({ opIndex: i, state: Object.freeze({ ...state }) });
        if (op) nextKey = (Math.floor(op.t / interval) + 1) * interval;
      }
      if (!op) break;
      state = this.fold(state, op);
    }
    for (const [id, b] of Object.entries(behaviors)) {
      if (!b.continuous) continue;
      const times: number[] = [];
      const values: unknown[] = [];
      if (id in timeline.initial) {
        times.push(-Infinity);
        values.push(timeline.initial[id]);
      }
      for (const op of ops) {
        if (op.s !== id) continue;
        times.push(op.t);
        values.push(op.v);
      }
      this.streams.set(id, { times, values });
    }
  }

  get duration(): number {
    return this.timeline.duration;
  }

  get keyframeCount(): number {
    return this.keyframes.length;
  }

  private fold(state: Record<SliceId, unknown>, op: TimelineOp): Record<SliceId, unknown> {
    if (this.behaviors[op.s]?.continuous) return state;
    const reduce = this.behaviors[op.s]?.reduce;
    state[op.s] = op.p && reduce ? reduce(state[op.s], op.v) : op.v;
    return state;
  }

  /** Complete state at lesson time `time` (clamped to [0, duration]). */
  stateAt(time: number): LessonState {
    const t = Math.max(0, Math.min(this.timeline.duration, time));
    const ops = this.timeline.ops;
    const end = upperBound(ops, t);
    let k = this.keyframes.length - 1;
    while (k > 0 && this.keyframes[k]!.opIndex > end) k--;
    const kf = this.keyframes[k]!;
    let state: Record<SliceId, unknown> = { ...kf.state };
    for (let i = kf.opIndex; i < end; i++) state = this.fold(state, ops[i]!);
    for (const [id, stream] of this.streams) {
      const i = lastAtOrBefore(stream.times, t);
      if (i < 0) {
        delete state[id];
        continue;
      }
      const a = stream.values[i];
      const tb = stream.times[i + 1];
      const behavior = this.behaviors[id];
      const interp = behavior?.interpolate;
      const tooFar = tb !== undefined && tb - stream.times[i]! > (behavior?.maxGapMs ?? Infinity);
      if (tb === undefined || !interp || tooFar || a === null || stream.values[i + 1] === null) {
        state[id] = a;
      } else {
        const ta = stream.times[i]!;
        const alpha = Number.isFinite(ta) && tb > ta ? (t - ta) / (tb - ta) : 0;
        state[id] = interp(a, stream.values[i + 1], alpha);
      }
    }
    return state;
  }

  /** Naive full fold (reference implementation; used by tests to validate keyframing). */
  stateAtNaive(time: number): LessonState {
    const t = Math.max(0, Math.min(this.timeline.duration, time));
    const state: Record<SliceId, unknown> = { ...this.timeline.initial };
    for (const op of this.timeline.ops) {
      if (op.t > t) break;
      const reduce = this.behaviors[op.s]?.reduce;
      state[op.s] = op.p && reduce ? reduce(state[op.s], op.v) : op.v;
    }
    return state;
  }
}
