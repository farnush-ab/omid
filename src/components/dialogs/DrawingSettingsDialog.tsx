'use client';

import { useMemo, useState } from 'react';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/core';
import { drawingRegistry, type ChartPoint, type SerializedDrawing } from '@/lib/drawings';
import { SchemaForm } from '../schema-form/SchemaForm';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Tabs } from '../ui/Tabs';

const COORDS_TAB = 'coordinates';
const inputCls =
  'h-8 rounded-md border border-line bg-transparent px-2 text-[13px] text-fg outline-none focus:border-accent';

/**
 * Per-drawing settings with Style tab(s) from the tool's schema and an auto-generated
 * Coordinates tab. Edits preview live; OK commits one undoable step, Cancel restores.
 */
export function DrawingSettingsDialog({
  drawingId,
  initialTab,
  onClose,
}: {
  drawingId: string;
  initialTab?: string | undefined;
  onClose: () => void;
}) {
  const app = useApp();
  const pushToast = useUiStore((s) => s.pushToast);
  const drawing = app.drawings.store.get(drawingId);
  const [before] = useState<SerializedDrawing | null>(() => drawing?.serialize() ?? null);
  const [draft, setDraft] = useState<SerializedDrawing | null>(before);
  const def = drawing ? drawingRegistry.get(drawing.type) : undefined;
  const tabs = useMemo(
    () => (def ? [...def.settings.tabs, { id: COORDS_TAB, label: 'Coordinates', groups: [] }] : []),
    [def],
  );
  const [tab, setTab] = useState(initialTab ?? tabs[0]?.id ?? COORDS_TAB);
  if (!drawing || !def || !draft || !before) return null;
  const coords = app.engine.coords;
  const symbol = app.engine.getSymbol();

  const apply = (next: SerializedDrawing) => {
    setDraft(next);
    app.drawings.preview(drawingId, next);
  };
  const setStyle = (key: string, value: unknown) =>
    apply({ ...draft, style: { ...draft.style, [key]: value } });
  const setPoint = (i: number, p: Partial<ChartPoint>) =>
    apply({ ...draft, points: draft.points.map((q, j) => (j === i ? { ...q, ...p } : q)) });

  const cancel = () => {
    app.drawings.preview(drawingId, before);
    onClose();
  };
  const ok = () => {
    app.drawings.commit(drawingId, before, `Edit ${def.label}`);
    onClose();
  };

  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  return (
    <Dialog
      title={def.label}
      onClose={cancel}
      width={560}
      footer={
        <>
          <select
            aria-label="Template"
            className="h-8 rounded-md border border-line bg-panel px-2 text-[13px]"
            value=""
            onChange={(e) => {
              if (e.target.value === 'save') {
                app.drawings.defaults.set(def.id, draft.style);
                pushToast(`Saved as default for ${def.label}`);
              } else if (e.target.value === 'reset') {
                app.drawings.defaults.reset(def.id);
                apply({
                  ...draft,
                  style: app.drawings.defaults.resolve(def, app.engine.getTheme()),
                });
              }
            }}
          >
            <option value="" disabled>
              Template
            </option>
            <option value="save">Save as default</option>
            <option value="reset">Reset to default</option>
          </select>
          <div className="flex-1" />
          <Button onClick={cancel}>Cancel</Button>
          <Button variant="primary" onClick={ok}>
            Ok
          </Button>
        </>
      }
    >
      <Tabs tabs={tabs} active={current.id} onChange={setTab} />
      <div role="tabpanel" className="min-h-[320px]">
        {current.id === COORDS_TAB ? (
          <div className="flex flex-col gap-3 px-5 py-4">
            {draft.points.map((p, i) => (
              <fieldset key={i} className="flex flex-wrap items-center gap-2">
                <legend className="mb-1 w-full text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {def.pointLabels?.[i] ?? `Point ${i + 1}`}
                </legend>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  Price
                  <input
                    type="number"
                    step={symbol.tickSize}
                    className={`${inputCls} w-32`}
                    value={Number(p.price.toFixed(symbol.pricePrecision))}
                    onChange={(e) =>
                      Number.isFinite(e.target.valueAsNumber) &&
                      setPoint(i, { price: e.target.valueAsNumber })
                    }
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  Bar
                  <input
                    type="number"
                    step={1}
                    className={`${inputCls} w-24`}
                    value={Math.round(coords.timeToIndex(p.time))}
                    onChange={(e) =>
                      Number.isFinite(e.target.valueAsNumber) &&
                      setPoint(i, { time: coords.indexToTime(e.target.valueAsNumber) })
                    }
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  Time
                  <input
                    type="datetime-local"
                    className={`${inputCls} w-52`}
                    value={toDateTimeLocalValue(p.time)}
                    onChange={(e) => {
                      const t = fromDateTimeLocalValue(e.target.value);
                      if (t !== null) setPoint(i, { time: t });
                    }}
                  />
                </label>
              </fieldset>
            ))}
          </div>
        ) : (
          <SchemaForm groups={current.groups} values={draft.style} onChange={setStyle} />
        )}
      </div>
    </Dialog>
  );
}
