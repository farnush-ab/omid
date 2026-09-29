'use client';

import { useState } from 'react';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';
import { downloadText, readJsonFile } from '../ui/files';

/** Overflow menu: drawings import/export and secondary dialogs. */
export function MoreMenu() {
  const app = useApp();
  const symbol = useUiStore((s) => s.symbol?.symbol ?? 'chart');
  const openDialog = useUiStore((s) => s.openDialog);
  const pushToast = useUiStore((s) => s.pushToast);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const res = app.drawingStore.importJson(await readJsonFile(file));
    if (res.ok)
      pushToast(`Imported ${res.count} drawing(s)${res.skipped ? `, skipped ${res.skipped}` : ''}`);
    else pushToast(`Import failed: ${res.error}`, 'error');
  };

  const items: Array<{ label: string; icon: IconName; run: () => void }> = [
    {
      label: 'Export drawings (JSON)',
      icon: 'download',
      run: () => downloadText(`${symbol}.drawings.json`, app.drawingStore.exportJson()),
    },
    { label: 'Import drawings…', icon: 'upload', run: () => fileInput?.click() },
    { label: 'Themes…', icon: 'palette', run: () => openDialog({ type: 'theme-editor' }) },
    { label: 'Keyboard shortcuts', icon: 'keyboard', run: () => openDialog({ type: 'shortcuts' }) },
  ];

  return (
    <>
      <IconButton
        icon="more"
        label="More"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      />
      <input
        ref={setFileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="-m-2 flex min-w-56 flex-col" role="menu">
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
    </>
  );
}
