'use client';

import { useMemo, useState } from 'react';
import { useApp } from '../state/app-context';
import { Dialog } from '../ui/Dialog';

/** Symbol search: filter the catalogue, arrows to move, Enter to pick (any typed symbol allowed). */
export function SymbolSearchDialog({
  initial = '',
  onClose,
}: {
  readonly initial?: string | undefined;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const [query, setQuery] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const results = useMemo(() => app.deps.provider.searchSymbols(query), [app, query]);
  const typed = query.trim().toUpperCase();
  const items =
    typed && !results.some((r) => r.symbol === typed) && /^[A-Z0-9]{2,20}$/.test(typed)
      ? [...results, app.deps.provider.getSymbolInfo(typed)]
      : results;

  const pick = (symbol: string) => {
    onClose();
    void app.setSymbol(symbol);
  };

  return (
    <Dialog title="Symbol search" onClose={onClose} width={520} initialFocus="input">
      <div className="border-b border-line px-4 py-3">
        <input
          value={query}
          autoFocus
          placeholder="Search, e.g. BTCUSDT"
          aria-label="Symbol"
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setCursor((c) => Math.min(items.length - 1, c + 1));
            else if (e.key === 'ArrowUp') setCursor((c) => Math.max(0, c - 1));
            else if (e.key === 'Enter' && items[cursor]) pick(items[cursor]!.symbol);
            else return;
            e.preventDefault();
          }}
          className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-[15px] uppercase text-fg outline-none focus:border-accent"
        />
      </div>
      <ul role="listbox" aria-label="Symbols" className="max-h-96 overflow-auto py-1">
        {items.map((s, i) => (
          <li key={s.symbol} role="option" aria-selected={i === cursor}>
            <button
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(s.symbol)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === cursor ? 'bg-hover' : ''}`}
            >
              <span className="w-28 font-semibold">{s.symbol}</span>
              <span className="flex-1 truncate text-[13px] text-muted">{s.description}</span>
              <span className="text-[11px] text-muted">tick {s.tickSize}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
