import type { FrameScheduler } from '../contracts/runtime';

/** Coalesces invalidations into at most one frame; renders only dirty layers. */
export class RenderLoop {
  private dirty = 0;
  private handle: number | null = null;
  private destroyed = false;

  constructor(
    private readonly scheduler: FrameScheduler,
    private readonly onFrame: (mask: number) => void,
  ) {}

  invalidate(mask: number): void {
    if (this.destroyed || mask === 0) return;
    this.dirty |= mask;
    if (this.handle === null) this.handle = this.scheduler.request(this.flush);
  }

  get pending(): number {
    return this.dirty;
  }

  /** Renders synchronously (tests, resize). */
  flush = (): void => {
    this.handle = null;
    const mask = this.dirty;
    this.dirty = 0;
    if (mask && !this.destroyed) this.onFrame(mask);
  };

  destroy(): void {
    this.destroyed = true;
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
  }
}
