'use client';

import { useState } from 'react';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';

/** "Replay" toggle plus the quick start-point options (select bar / date / first / random). */
export function ReplayButton() {
  const app = useApp();
  const state = useUiStore((s) => s.replay.state);
  const openDialog = useUiStore((s) => s.openDialog);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const on = state !== 'idle' && state !== 'exited';

  const items: Array<{ label: string; icon: IconName; run: () => void }> = [
    { label: 'Select bar', icon: 'scissors', run: () => app.replay.startSelecting() },
    { label: 'Select date…', icon: 'calendar', run: () => openDialog({ type: 'replay-date' }) },
    {
      label: 'First available bar',
      icon: 'first',
      run: () => {
        app.replay.startSelecting();
        void app.replay.selectFirstBar();
      },
    },
    {
      label: 'Random bar',
      icon: 'shuffle',
      run: () => {
        app.replay.startSelecting();
        void app.replay.selectRandomBar();
      },
    },
  ];

  return (
    <div className="flex items-center">
      <Tooltip label={on ? 'Exit bar replay' : 'Bar replay — pick a start bar'}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => (on ? app.replay.exit() : app.replay.startSelecting())}
          className={`flex h-8 items-center gap-1.5 rounded-l-md pl-2 pr-1.5 text-[13px] font-medium hover:bg-hover ${on ? 'text-accent' : 'text-fg'}`}
        >
          <Icon name="replay" size={17} />
          <span className="hidden md:inline">Replay</span>
        </button>
      </Tooltip>
      <button
        type="button"
        aria-label="Replay start options"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="flex h-8 w-5 items-center justify-center rounded-r-md text-muted hover:bg-hover hover:text-fg"
      >
        <Icon name="chevronDown" size={13} />
      </button>
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="-m-2 flex min-w-48 flex-col" role="menu">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAnchor(null);
                  it.run();
                }}
                className="flex h-9 items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover"
              >
                <Icon name={it.icon} size={16} />
                {it.label}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}
    </div>
  );
}
