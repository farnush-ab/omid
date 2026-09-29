'use client';

import { useMemo, useState } from 'react';
import { drawingRegistry, type ChartPoint, type SerializedDrawing } from '@/lib/drawings';
import { SchemaForm } from '../schema-form/SchemaForm';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Tabs } from '../ui/Tabs';
import { CoordinatesTab } from './CoordinatesTab';

const COORDS_TAB = 'coordinates';

/**
 * Per-drawing settings: the tool's schema tabs (plus derived fields) and an auto-generated
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
  const symbol = app.engine.getSymbol();

  const apply = (next: SerializedDrawing) => {
    setDraft(next);
    app.drawings.preview(drawingId, next);
  };
  const derived = def.derivedFields;
  const values = derived ? { ...draft.style, ...derived.get(draft, symbol) } : draft.style;
  const setField = (key: string, value: unknown) =>
    apply(
      derived?.keys.includes(key)
        ? derived.set(draft, key, value, symbol)
        : { ...draft, style: { ...draft.style, [key]: value } },
    );
  const setPoint = (i: number, p: Partial<ChartPoint>) => {
    const points = draft.points.map((q, j) => (j === i ? { ...q, ...p } : q));
    apply({ ...draft, points: def.normalizePoints ? def.normalizePoints(points) : points });
  };

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
      width={580}
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
          <CoordinatesTab
            def={def}
            draft={draft}
            coords={app.engine.coords}
            symbol={symbol}
            onPoint={setPoint}
          />
        ) : (
          <SchemaForm groups={current.groups} values={values} onChange={setField} />
        )}
      </div>
    </Dialog>
  );
}
