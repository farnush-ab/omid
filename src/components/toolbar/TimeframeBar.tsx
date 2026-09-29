'use client';

import { TIMEFRAMES, TIMEFRAME_IDS } from '@/lib/core';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Tooltip } from '../ui/Tooltip';

/** All supported intervals; type a number anywhere on the chart for the quick switch. */
export function TimeframeBar() {
  const app = useApp();
  const current = useUiStore((s) => s.timeframe);
  return (
    <div
      className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]"
      role="radiogroup"
      aria-label="Interval"
    >
      {TIMEFRAME_IDS.map((id) => (
        <Tooltip key={id} label={`Interval ${TIMEFRAMES[id].label}`} shortcut="type e.g. 4h ↵">
          <button
            type="button"
            role="radio"
            aria-checked={id === current}
            onClick={() => void app.setTimeframe(id)}
            className={`h-8 shrink-0 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-hover ${
              id === current ? 'text-accent' : 'text-fg'
            }`}
          >
            {TIMEFRAMES[id].label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
