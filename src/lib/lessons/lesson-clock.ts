import type { Clock } from '@/lib/core';

export type RecordingClockState = 'idle' | 'running' | 'paused' | 'stopped';

/**
 * Lesson time while recording: wall-clock time that only advances while running. Paused spans
 * are simply not counted, so they never exist in the lesson. Monotonic by construction.
 */
export class RecordingClock {
  private status: RecordingClockState = 'idle';
  private accumulated = 0;
  private resumedAt = 0;
  private last = 0;

  constructor(private readonly clock: Clock) {}

  get state(): RecordingClockState {
    return this.status;
  }

  start(): void {
    if (this.status !== 'idle') throw new Error(`Cannot start a ${this.status} clock`);
    this.status = 'running';
    this.resumedAt = this.clock.now();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.accumulated = this.now();
    this.status = 'paused';
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.resumedAt = this.clock.now();
  }

  /** Stops and returns the final lesson duration (ms). */
  stop(): number {
    if (this.status === 'running') this.accumulated = this.now();
    this.status = 'stopped';
    return this.accumulated;
  }

  /** Current lesson time in whole milliseconds; never decreases. */
  now(): number {
    const raw =
      this.status === 'running'
        ? this.accumulated + Math.max(0, this.clock.now() - this.resumedAt)
        : this.accumulated;
    this.last = Math.max(this.last, Math.round(raw));
    return this.last;
  }
}
