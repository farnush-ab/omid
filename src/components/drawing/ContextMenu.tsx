'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';

interface Item {
  readonly label: string;
  readonly icon?: IconName;
  readonly shortcut?: string;
  readonly danger?: boolean;
  readonly run: () => void;
}
type Entry = Item | 'divider' | { readonly submenu: string; readonly items: readonly Item[] };

/** Right-click menu for drawings and the chart background. */
export function ContextMenu() {
  const app = useApp();
  const menu = useUiStore((s) => s.contextMenu);
  const close = () => useUiStore.getState().openContextMenu(null);
  const openDialog = useUiStore((s) => s.openDialog);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.min(menu.clientX, window.innerWidth - r.width - 8),
      top: Math.min(menu.clientY, window.innerHeight - r.height - 8),
    });
    ref.current.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menu]);

  if (!menu) return null;
  const d = app.drawings;
  let entries: Entry[];
  if (menu.target.kind === 'drawing') {
    const id = menu.target.id;
    const drawing = d.store.get(id);
    if (!drawing) return null;
    entries = [
      {
        label: 'Settings…',
        icon: 'settings',
        run: () => openDialog({ type: 'drawing-settings', drawingId: id }),
      },
      { label: 'Clone', icon: 'clone', shortcut: 'Ctrl+D', run: () => d.clone(id, 3) },
      { label: 'Copy', shortcut: 'Ctrl+C', run: () => d.copySelected() },
      {
        label: drawing.locked ? 'Unlock' : 'Lock',
        icon: drawing.locked ? 'unlock' : 'lock',
        run: () => d.setLocked(id, !drawing.locked),
      },
      { label: 'Hide', icon: 'eyeOff', run: () => d.setHidden(id, true) },
      {
        submenu: 'Visual order',
        items: [
          { label: 'Bring to front', icon: 'front', run: () => d.reorder(id, 'front') },
          { label: 'Bring forward', run: () => d.reorder(id, 'forward') },
          { label: 'Send backward', run: () => d.reorder(id, 'backward') },
          { label: 'Send to back', icon: 'back', run: () => d.reorder(id, 'back') },
        ],
      },
      'divider',
      { label: 'Remove', icon: 'trash', shortcut: 'Del', danger: true, run: () => d.remove([id]) },
    ];
  } else {
    entries = [
      {
        label: 'Reset chart view',
        icon: 'reset',
        shortcut: 'Alt+R',
        run: () => app.engine.resetView(),
      },
      { label: 'Paste', shortcut: 'Ctrl+V', run: () => d.paste() },
      {
        label: d.modes.hideAll ? 'Show all drawings' : 'Hide all drawings',
        icon: 'eye',
        run: () => d.setModes({ hideAll: !d.modes.hideAll }),
      },
      {
        label: d.modes.lockAll ? 'Unlock all drawings' : 'Lock all drawings',
        icon: 'lock',
        run: () => d.setModes({ lockAll: !d.modes.lockAll }),
      },
      { label: 'Remove all drawings', icon: 'trash', danger: true, run: () => d.removeAll() },
      'divider',
      { label: 'Chart settings…', icon: 'settings', run: () => openDialog({ type: 'settings' }) },
    ];
  }

  const renderItem = (it: Item) => (
    <button
      key={it.label}
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        it.run();
      }}
      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover focus:bg-hover focus:outline-none ${it.danger ? 'text-down' : ''}`}
    >
      <span className="w-4">{it.icon ? <Icon name={it.icon} size={15} /> : null}</span>
      <span className="flex-1">{it.label}</span>
      {it.shortcut ? <span className="text-[11px] text-muted">{it.shortcut}</span> : null}
    </button>
  );

  return (
    <div
      ref={ref}
      role="menu"
      style={pos}
      className="fixed z-40 min-w-52 animate-pop rounded-lg border border-line bg-panel p-1 text-fg shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((e, i) =>
        e === 'divider' ? (
          <div key={`d${i}`} className="my-1 h-px bg-line" />
        ) : 'submenu' in e ? (
          <div key={e.submenu} className="group/sub relative">
            <div className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-hover">
              <span className="w-4" />
              <span className="flex-1">{e.submenu}</span>
              <Icon name="chevronRight" size={14} />
            </div>
            <div className="invisible absolute left-full top-0 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-2xl group-focus-within/sub:visible group-hover/sub:visible">
              {e.items.map(renderItem)}
            </div>
          </div>
        ) : (
          renderItem(e)
        ),
      )}
    </div>
  );
}
