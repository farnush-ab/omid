'use client';

import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
  type ChartCoordinates,
  type SymbolInfo,
} from '@/lib/core';
import type { AnyToolDefinition, ChartPoint, SerializedDrawing } from '@/lib/drawings';

const inputCls =
  'h-8 rounded-md border border-line bg-transparent px-2 text-[13px] text-fg outline-none focus:border-accent';

interface CoordinatesTabProps {
  readonly def: AnyToolDefinition;
  readonly draft: SerializedDrawing;
  readonly coords: ChartCoordinates;
  readonly symbol: SymbolInfo;
  readonly onPoint: (index: number, patch: Partial<ChartPoint>) => void;
}

/** Auto-generated "Coordinates" tab: price, bar number and local time of every anchor. */
export function CoordinatesTab({ def, draft, coords, symbol, onPoint }: CoordinatesTabProps) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      {draft.points.map((p, i) => {
        const fields = def.coordinateFields?.[i] ?? ['time', 'price'];
        return (
          <fieldset key={i} className="flex flex-wrap items-center gap-2">
            <legend className="mb-1 w-full text-[11px] font-semibold uppercase tracking-wider text-muted">
              {def.pointLabels?.[i] ?? `Point ${i + 1}`}
            </legend>
            {fields.includes('price') ? (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Price
                <input
                  type="number"
                  step={symbol.tickSize}
                  className={`${inputCls} w-32`}
                  value={Number(p.price.toFixed(symbol.pricePrecision))}
                  onChange={(e) =>
                    Number.isFinite(e.target.valueAsNumber) &&
                    onPoint(i, { price: e.target.valueAsNumber })
                  }
                />
              </label>
            ) : null}
            {fields.includes('time') ? (
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  Bar
                  <input
                    type="number"
                    step={1}
                    className={`${inputCls} w-24`}
                    value={Math.round(coords.timeToIndex(p.time))}
                    onChange={(e) =>
                      Number.isFinite(e.target.valueAsNumber) &&
                      onPoint(i, { time: coords.indexToTime(e.target.valueAsNumber) })
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
                      if (t !== null) onPoint(i, { time: t });
                    }}
                  />
                </label>
              </>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
