/** Injected sources of time and scheduling. Core logic never reads the wall clock directly. */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** Abstraction over requestAnimationFrame so the render loop is testable. */
export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

/** Abstraction over setTimeout/setInterval (replay ticks, long-press detection). */
export interface Timer {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

/** Deterministic pseudo random generator. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
}
