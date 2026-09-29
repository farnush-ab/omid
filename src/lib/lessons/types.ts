import type { SymbolInfo, TimeframeId } from '@/lib/core';

/** Bumped whenever the serialized timeline shape changes (see codec + migrations). */
export const LESSON_TIMELINE_VERSION = 1;

export type SliceId = string;

/**
 * One recorded change. `t` is lesson time in ms (paused time never exists). By default the op
 * replaces the slice value; `p: 1` marks a patch reduced by the slice's `reduce`.
 */
export interface TimelineOp {
  readonly t: number;
  readonly s: SliceId;
  readonly v: unknown;
  readonly p?: 1;
}

/** Value of every recorded slice at some instant. Values are immutable. */
export type LessonState = Readonly<Record<SliceId, unknown>>;

/** Candles stored inside the lesson so playback never depends on live data. */
export interface LessonDataset {
  readonly key: string;
  readonly symbol: SymbolInfo;
  readonly timeframe: TimeframeId;
  /** Columnar OHLCV: [time[], open[], high[], low[], close[], volume[]]. */
  readonly columns: readonly [number[], number[], number[], number[], number[], number[]];
}

export interface LessonTimeline {
  readonly version: number;
  /** Lesson length in ms. */
  readonly duration: number;
  readonly initial: LessonState;
  /** Sorted by `t` (stable). */
  readonly ops: readonly TimelineOp[];
  readonly datasets: readonly LessonDataset[];
}

/**
 * How the pure timeline treats a slice. Continuous slices (cursor, view) are sampled and
 * interpolated between samples; discrete ones step. `reduce` applies patch ops.
 */
export interface SliceBehavior {
  readonly continuous?: boolean;
  /** Samples further apart than this (ms) are held, not interpolated (default: always interpolate). */
  readonly maxGapMs?: number;
  interpolate?(a: unknown, b: unknown, alpha: number): unknown;
  reduce?(prev: unknown, patch: unknown): unknown;
}

export type SliceBehaviors = Readonly<Record<SliceId, SliceBehavior>>;
