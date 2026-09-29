'use client';

import { useUiStore } from '../state/ui-store';

/** The "Change interval" box shown while typing a timeframe. */
export function IntervalTyperOverlay() {
  const typer = useUiStore((s) => s.intervalTyper);
  if (!typer) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 animate-pop rounded-lg border border-line bg-panel px-4 py-3 shadow-2xl">
      <div className="text-[11px] uppercase tracking-wider text-muted">Change interval</div>
      <div className={`mt-1 font-mono text-2xl ${typer.valid ? 'text-fg' : 'text-down'}`}>
        {typer.text}
      </div>
      <div className="mt-1 text-[11px] text-muted">
        {typer.valid ? 'Enter to apply' : 'Not a supported interval'}
      </div>
    </div>
  );
}
