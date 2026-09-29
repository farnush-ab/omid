'use client';

import { useEffect, useRef, useState } from 'react';
import type { Theme, ThemeColorKey, ThemeColors } from '@/lib/core';
import { THEME_COLOR_GROUPS } from '@/lib/themes';
import { ColorPicker } from '../schema-form/ColorPicker';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { downloadText, readJsonFile } from '../ui/files';

/**
 * Theme manager + creator: pick, create, duplicate, rename, delete, import/export, and edit
 * every colour with instant live preview. Unsaved edits are discarded on close.
 */
export function ThemeEditorDialog({ onClose }: { readonly onClose: () => void }) {
  const app = useApp();
  const themes = useUiStore((s) => s.themes);
  const active = useUiStore((s) => s.activeTheme);
  const pushToast = useUiStore((s) => s.pushToast);
  const [selectedId, setSelectedId] = useState(active.id);
  const selected: Theme = themes.find((t) => t.id === selectedId) ?? active;
  const [draft, setDraft] = useState<ThemeColors>(selected.colors);
  const [name, setName] = useState(selected.name);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => app.themes.preview(null), [app]);

  const select = (t: Theme) => {
    setSelectedId(t.id);
    setDraft(t.colors);
    setName(t.name);
    setDirty(false);
    app.themes.setActive(t.id);
  };

  const editColor = (key: ThemeColorKey, value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setDirty(true);
    app.themes.preview({ ...selected, colors: next });
  };

  const save = () => {
    app.themes.save(selected.id, draft, name);
    app.themes.setActive(selected.id);
    setDirty(false);
  };

  /** Copies the selected theme, carrying over any unsaved (previewed) edits. */
  const duplicate = () => {
    const copy = app.themes.duplicate(selected.id, `${selected.name} copy`);
    if (dirty) app.themes.save(copy.id, draft);
    select(app.themes.find(copy.id) ?? copy);
  };

  const remove = () => {
    app.themes.remove(selected.id);
    const fallback = app.themes.active;
    select(fallback);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const res = app.themes.importTheme(await readJsonFile(file));
    if (res.ok) {
      select(res.theme);
      pushToast(`Imported theme “${res.theme.name}”`);
    } else pushToast(`Import failed: ${res.error}`, 'error');
  };

  return (
    <Dialog
      title="Themes"
      onClose={onClose}
      width={780}
      footer={
        <>
          <Button onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} /> Import
          </Button>
          <Button
            onClick={() =>
              downloadText(`${selected.name}.theme.json`, app.themes.exportTheme(selected.id))
            }
          >
            <Icon name="download" size={15} /> Export
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void onImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex-1" />
          {dirty ? (
            <span className="text-xs text-muted">Unsaved changes (live preview)</span>
          ) : null}
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={selected.builtIn || !dirty} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex min-h-[460px] flex-col sm:flex-row">
        <aside className="flex shrink-0 flex-col gap-1 border-b border-line p-2 sm:w-52 sm:border-b-0 sm:border-r">
          <ul role="listbox" aria-label="Themes" className="flex flex-col gap-0.5">
            {themes.map((t) => (
              <li key={t.id} role="option" aria-selected={t.id === selected.id}>
                <button
                  type="button"
                  onClick={() => select(t)}
                  className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] ${t.id === selected.id ? 'bg-hover font-semibold' : 'hover:bg-hover'}`}
                >
                  <span className="flex h-4 w-6 overflow-hidden rounded-sm border border-line">
                    <span className="flex-1" style={{ background: t.colors.background }} />
                    <span className="w-1.5" style={{ background: t.colors.upBody }} />
                    <span className="w-1.5" style={{ background: t.colors.downBody }} />
                  </span>
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.builtIn ? (
                    <span className="text-[10px] uppercase text-muted">built-in</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button variant="ghost" onClick={duplicate}>
              <Icon name="plus" size={15} /> New
            </Button>
            <Button variant="ghost" onClick={duplicate}>
              <Icon name="clone" size={15} /> Duplicate
            </Button>
            {!selected.builtIn ? (
              <Button variant="danger" onClick={remove}>
                <Icon name="trash" size={15} /> Delete
              </Button>
            ) : null}
          </div>
        </aside>
        <div className="min-w-0 flex-1 px-5 py-4">
          <label className="mb-4 flex items-center gap-3 text-[13px] text-muted">
            Name
            <input
              value={name}
              disabled={selected.builtIn}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              onBlur={() =>
                !selected.builtIn && name.trim() && app.themes.rename(selected.id, name)
              }
              className="h-8 flex-1 rounded-md border border-line bg-transparent px-2 text-fg outline-none focus:border-accent disabled:opacity-60"
            />
          </label>
          {selected.builtIn ? (
            <p className="mb-3 rounded-md bg-hover px-3 py-2 text-[13px] text-muted">
              Built-in themes are read-only. Edits are previewed live; use <b>Duplicate</b> to keep
              them.
            </p>
          ) : null}
          <div className="grid gap-5 md:grid-cols-2">
            {THEME_COLOR_GROUPS.map((g) => (
              <section key={g.id}>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {g.label}
                </h3>
                {g.colors.map((c) => (
                  <div
                    key={c.key}
                    className="flex h-9 items-center justify-between gap-2 text-[13px]"
                  >
                    <span>{c.label}</span>
                    <ColorPicker
                      label={c.label}
                      color={draft[c.key]}
                      onChange={(color) => editColor(c.key, color)}
                    />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
