'use client';

import { useState } from 'react';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/core';
import { useApp } from '../state/app-context';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

/** "Select date…" replay start option. */
export function ReplayDateDialog({ onClose }: { readonly onClose: () => void }) {
  const app = useApp();
  const data = app.market.data;
  const first = data.time[0] ?? 0;
  const last = data.time[data.lastIndex] ?? 0;
  const [value, setValue] = useState(() => toDateTimeLocalValue(first + (last - first) * 0.5));
  const start = () => {
    const t = fromDateTimeLocalValue(value);
    if (t === null) return;
    onClose();
    app.replay.startSelecting();
    void app.replay.selectTime(t);
  };
  return (
    <Dialog
      title="Start replay from date"
      onClose={onClose}
      width={420}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={start}>
            Start
          </Button>
        </>
      }
    >
      <div className="px-5 py-4">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Date and time (local)
          <input
            type="datetime-local"
            value={value}
            min={toDateTimeLocalValue(first)}
            max={toDateTimeLocalValue(last)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            className="h-9 rounded-md border border-line bg-transparent px-2 text-fg outline-none focus:border-accent"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Loaded history: {new Date(first).toLocaleString()} – {new Date(last).toLocaleString()}
        </p>
      </div>
    </Dialog>
  );
}
