'use client';

import { useRef, type KeyboardEvent } from 'react';

interface TabsProps {
  readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly active: string;
  readonly onChange: (id: string) => void;
  readonly vertical?: boolean;
}

/** Roving-tabindex tab list (arrow keys move between tabs). */
export function Tabs({ tabs, active, onChange, vertical = false }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
    const d = next[e.key as keyof typeof next];
    if (!d) return;
    e.preventDefault();
    const j = (i + d + tabs.length) % tabs.length;
    onChange(tabs[j]!.id);
    refs.current[j]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={
        vertical
          ? 'flex w-40 shrink-0 flex-col gap-0.5 border-r border-line p-2'
          : 'flex gap-1 border-b border-line px-4'
      }
    >
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => void (refs.current[i] = el)}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.id)}
            className={
              vertical
                ? `h-9 rounded-md px-3 text-left text-[13px] transition-colors ${on ? 'bg-hover font-semibold text-fg' : 'text-muted hover:bg-hover hover:text-fg'}`
                : `-mb-px h-10 border-b-2 px-2 text-[13px] font-medium transition-colors ${on ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
