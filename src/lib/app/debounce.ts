import type { Timer } from '@/lib/core';

/** Trailing debounce on an injected Timer. `flush()` runs a pending call immediately. */
export function debounce(
  timer: Timer,
  ms: number,
  fn: () => void,
): { (): void; flush(): void; cancel(): void } {
  let handle: number | null = null;
  const run = () => {
    handle = null;
    fn();
  };
  const d = () => {
    if (handle !== null) timer.clearTimeout(handle);
    handle = timer.setTimeout(run, ms);
  };
  d.flush = () => {
    if (handle !== null) {
      timer.clearTimeout(handle);
      run();
    }
  };
  d.cancel = () => {
    if (handle !== null) timer.clearTimeout(handle);
    handle = null;
  };
  return d;
}
