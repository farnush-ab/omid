import type { Clock, EngineRuntime, FrameScheduler, Timer } from '@/lib/core';

/** Wall clock — only the application layer may read real time. */
export const systemClock: Clock = { now: () => Date.now() };

export const rafScheduler: FrameScheduler = {
  request: (cb) => window.requestAnimationFrame(() => cb()),
  cancel: (h) => window.cancelAnimationFrame(h),
};

export const windowTimer: Timer = {
  setTimeout: (cb, ms) => window.setTimeout(cb, ms),
  clearTimeout: (h) => window.clearTimeout(h),
  setInterval: (cb, ms) => window.setInterval(cb, ms),
  clearInterval: (h) => window.clearInterval(h),
};

export function createBrowserRuntime(): EngineRuntime {
  return {
    frames: rafScheduler,
    timer: windowTimer,
    clock: systemClock,
    devicePixelRatio: () => window.devicePixelRatio || 1,
  };
}
