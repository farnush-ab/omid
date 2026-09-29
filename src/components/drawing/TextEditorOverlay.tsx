'use client';

import { useEffect, useRef, useState } from 'react';
import type { SerializedDrawing } from '@/lib/drawings';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';

const MIN_WIDTH = 140;

/**
 * Inline text editing for drawings that expose `textKey` + `textRect` (Text tool).
 * Live-previews on the canvas; blur / Ctrl+Enter commits one undoable edit, Esc cancels,
 * an empty text removes the drawing.
 */
export function TextEditorOverlay() {
  const app = useApp();
  const id = useUiStore((s) => s.textEdit);
  const setTextEdit = useUiStore((s) => s.setTextEdit);
  const drawing = id ? app.drawings.store.get(id) : undefined;
  if (!id || !drawing?.textKey || !drawing.textRect) return null;
  return <Editor key={id} id={id} onDone={() => setTextEdit(null)} />;
}

function Editor({ id, onDone }: { id: string; onDone: () => void }) {
  const app = useApp();
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const [before] = useState<SerializedDrawing | null>(
    () => app.drawings.store.get(id)?.serialize() ?? null,
  );
  const drawing = app.drawings.store.get(id)!;
  const key = drawing.textKey!;
  const [value, setValue] = useState(String(before?.style[key] ?? ''));
  const [rect] = useState(() => drawing.textRect!(app.drawings.context()));
  const style = before?.style ?? {};

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  if (!before || !rect) return null;

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (!commit) app.drawings.preview(id, before);
    else if (!value.trim()) app.drawings.remove([id]);
    else app.drawings.commit(id, before, 'Edit text');
    onDone();
  };

  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        app.drawings.preview(id, { ...before, style: { ...before.style, [key]: e.target.value } });
      }}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true);
      }}
      rows={Math.max(1, value.split('\n').length)}
      style={{
        left: rect.x,
        top: rect.y,
        minWidth: Math.max(MIN_WIDTH, rect.width),
        font: `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${Number(style.fontSize ?? 14)}px ${String(style.fontFamily ?? 'sans-serif')}`,
        color: String(style.color ?? 'inherit'),
      }}
      className="absolute z-30 resize rounded border border-accent bg-panel/95 px-1 py-0.5 leading-[1.3] shadow-xl outline-none"
    />
  );
}
