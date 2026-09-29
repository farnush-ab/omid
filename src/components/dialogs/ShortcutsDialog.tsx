'use client';

import { chordLabel } from '@/lib/app';
import { useApp } from '../state/app-context';
import { Dialog } from '../ui/Dialog';

/** Lists every shortcut from the central registry, grouped by category. */
export function ShortcutsDialog({ onClose }: { readonly onClose: () => void }) {
  const app = useApp();
  const groups = [...app.shortcuts.byCategory()];
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width={640}>
      <div className="grid gap-6 px-5 py-4 sm:grid-cols-2">
        {groups.map(([category, list]) => (
          <section key={category}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {category}
            </h3>
            <dl className="flex flex-col gap-1">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <dt>{s.description}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded border border-line bg-hover px-1.5 py-0.5 font-mono text-[11px]"
                      >
                        {chordLabel(k)}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Quick switch
          </h3>
          <p className="text-[13px] text-muted">
            Type an interval anywhere (e.g. <kbd className="font-mono">5</kbd>,{' '}
            <kbd className="font-mono">4h</kbd>, <kbd className="font-mono">1D</kbd>) and press
            Enter. Start typing letters to search symbols.
          </p>
        </section>
      </div>
    </Dialog>
  );
}
