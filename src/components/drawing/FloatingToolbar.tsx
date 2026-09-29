'use client';

import { useRef, useState } from 'react';
import { schemaFields, type LineStyle, type SettingsField } from '@/lib/core';
import { drawingRegistry, type SerializedDrawing } from '@/lib/drawings';
import { ColorPicker } from '../schema-form/ColorPicker';
import { LINE_WIDTHS, LineStylePreview } from '../schema-form/fields/LineControls';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Divider } from '../ui/Divider';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';

type Change = (key: string, value: unknown) => void;

function MenuPick<T extends string | number>({
  label,
  value,
  options,
  render,
  onPick,
}: {
  label: string;
  value: T;
  options: readonly T[];
  render: (v: T) => React.ReactNode;
  onPick: (v: T) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 min-w-9 items-center justify-center rounded-md px-1.5 text-fg hover:bg-hover"
      >
        {render(value)}
      </button>
      {open ? (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div className="-m-2 flex flex-col" role="listbox" aria-label={label}>
            {options.map((o) => (
              <button
                key={String(o)}
                type="button"
                role="option"
                aria-selected={o === value}
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                }}
                className={`flex h-8 items-center gap-2 rounded-md px-2 hover:bg-hover ${o === value ? 'text-accent' : ''}`}
              >
                {render(o)}
              </button>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  );
}

function CompactField({
  field,
  sel,
  onChange,
}: {
  field: SettingsField;
  sel: SerializedDrawing;
  onChange: Change;
}) {
  const v = sel.style[field.key];
  switch (field.kind) {
    case 'color':
      return (
        <ColorPicker
          size="sm"
          label={field.label}
          color={String(v)}
          opacity={field.opacityKey ? Number(sel.style[field.opacityKey] ?? 1) : undefined}
          onChange={(c, a) => {
            onChange(field.key, c);
            if (field.opacityKey) onChange(field.opacityKey, a);
          }}
        />
      );
    case 'lineWidth':
      return (
        <MenuPick
          label="Line width"
          value={Number(v)}
          options={LINE_WIDTHS}
          onPick={(w) => onChange(field.key, w)}
          render={(w) => (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="block w-5 rounded bg-current" style={{ height: Math.min(w, 6) }} />
              {w}px
            </span>
          )}
        />
      );
    case 'lineStyle':
      return (
        <MenuPick
          label="Line style"
          value={v as LineStyle}
          options={['solid', 'dashed', 'dotted'] as const}
          onPick={(s) => onChange(field.key, s)}
          render={(s) => <LineStylePreview style={s} />}
        />
      );
    default:
      return null;
  }
}

/** Floating context toolbar for the selected drawing, generated from its tool definition. */
export function FloatingToolbar() {
  const app = useApp();
  const sel = useUiStore((s) => s.selection);
  const dialog = useUiStore((s) => s.dialog);
  const openDialog = useUiStore((s) => s.openDialog);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  if (!sel || dialog) return null;
  const def = drawingRegistry.get(sel.type);
  if (!def) return null;
  const fields = schemaFields(def.settings);
  const toolbarFields = def.toolbar
    .map((k) => fields.find((f) => f.key === k))
    .filter((f): f is SettingsField => !!f);
  const onChange: Change = (key, value) => app.drawings.updateStyle(sel.id, { [key]: value });

  const onGripDown = (e: React.PointerEvent) => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    const parent = ref.current?.offsetParent as HTMLElement | null;
    if (!drag.current || !parent) return;
    const p = parent.getBoundingClientRect();
    setPos({
      x: Math.max(0, Math.min(p.width - 60, e.clientX - p.left - drag.current.dx)),
      y: Math.max(0, Math.min(p.height - 40, e.clientY - p.top - drag.current.dy)),
    });
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={`${def.label} toolbar`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`absolute z-20 flex animate-pop items-center gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-xl ${pos ? '' : 'left-1/2 top-9 -translate-x-1/2'}`}
    >
      <span
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={() => (drag.current = null)}
        className="flex h-8 w-3 cursor-grab items-center justify-center text-muted active:cursor-grabbing"
        aria-hidden="true"
      >
        ⋮
      </span>
      {toolbarFields.map((f) => (
        <CompactField key={f.key} field={f} sel={sel} onChange={onChange} />
      ))}
      <Divider />
      <IconButton
        icon="settings"
        label="Settings"
        size={16}
        onClick={() => openDialog({ type: 'drawing-settings', drawingId: sel.id })}
      />
      <IconButton
        icon={sel.locked ? 'lock' : 'unlock'}
        label={sel.locked ? 'Unlock' : 'Lock'}
        size={16}
        active={sel.locked}
        onClick={() => app.drawings.setLocked(sel.id, !sel.locked)}
      />
      <IconButton
        icon="eyeOff"
        label="Hide"
        size={16}
        onClick={() => app.drawings.setHidden(sel.id, true)}
      />
      <IconButton
        icon="clone"
        label="Clone"
        shortcut="Ctrl + D"
        size={16}
        onClick={() => app.drawings.clone(sel.id, 3)}
      />
      <IconButton
        icon="front"
        label="Bring to front"
        size={16}
        onClick={() => app.drawings.reorder(sel.id, 'front')}
      />
      <IconButton
        icon="back"
        label="Send to back"
        size={16}
        onClick={() => app.drawings.reorder(sel.id, 'back')}
      />
      <IconButton
        icon="trash"
        label="Remove"
        shortcut="Del"
        size={16}
        onClick={() => app.drawings.remove([sel.id])}
      />
    </div>
  );
}
