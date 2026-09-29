'use client';

import {
  FONT_FAMILIES,
  FONT_SIZES,
  type LineStyle,
  type SettingsField,
  type SettingsValues,
} from '@/lib/core';
import { ColorPicker } from '../ColorPicker';
import { LineStyleControl, LineWidthControl } from './LineControls';

export type FieldChange = (key: string, value: unknown) => void;

const input =
  'h-8 rounded-md border border-line bg-transparent px-2 text-[13px] text-fg outline-none focus:border-accent';

const fontLabel = (f: string) => f.split(',')[0]!.replace(/"/g, '');

/** Renders the input for one schema field. Pure mapping from field kind to control. */
export function FieldControl({
  field,
  values,
  onChange,
}: {
  readonly field: SettingsField;
  readonly values: SettingsValues;
  readonly onChange: FieldChange;
}) {
  const v = values[field.key];
  switch (field.kind) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          aria-label={field.label}
          checked={Boolean(v)}
          onChange={(e) => onChange(field.key, e.target.checked)}
          className="h-4 w-4 accent-[var(--tc-accent)]"
        />
      );
    case 'color': {
      const opacity = field.opacityKey ? Number(values[field.opacityKey] ?? 1) : undefined;
      return (
        <ColorPicker
          label={field.label}
          color={String(v ?? '#000000')}
          opacity={opacity}
          onChange={(color, a) => {
            onChange(field.key, color);
            if (field.opacityKey) onChange(field.opacityKey, a);
          }}
        />
      );
    }
    case 'number':
      return (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="number"
            aria-label={field.label}
            className={`${input} w-24`}
            value={Number.isFinite(Number(v)) ? Number(v) : 0}
            {...(field.min !== undefined ? { min: field.min } : {})}
            {...(field.max !== undefined ? { max: field.max } : {})}
            step={field.step ?? 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n)) {
                const lo = field.min ?? -Infinity;
                const hi = field.max ?? Infinity;
                onChange(field.key, Math.min(hi, Math.max(lo, n)));
              }
            }}
          />
          {field.unit ? <span className="text-xs text-muted">{field.unit}</span> : null}
        </span>
      );
    case 'select':
      return (
        <select
          aria-label={field.label}
          className={`${input} min-w-32 bg-panel`}
          value={String(v)}
          onChange={(e) => {
            const opt = field.options.find((o) => String(o.value) === e.target.value);
            if (opt) onChange(field.key, opt.value);
          }}
        >
          {field.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'lineWidth':
      return <LineWidthControl value={Number(v)} onChange={(n) => onChange(field.key, n)} />;
    case 'lineStyle':
      return <LineStyleControl value={v as LineStyle} onChange={(s) => onChange(field.key, s)} />;
    case 'opacity':
      return (
        <span className="inline-flex items-center gap-2">
          <input
            type="range"
            aria-label={field.label}
            min={0}
            max={100}
            value={Math.round(Number(v) * 100)}
            onChange={(e) => onChange(field.key, Number(e.target.value) / 100)}
          />
          <span className="w-9 text-right text-xs tabular-nums">
            {Math.round(Number(v) * 100)}%
          </span>
        </span>
      );
    case 'fontSize':
      return (
        <select
          aria-label={field.label}
          className={`${input} bg-panel`}
          value={Number(v)}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    case 'fontFamily':
      return (
        <select
          aria-label={field.label}
          className={`${input} bg-panel`}
          value={String(v)}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {fontLabel(f)}
            </option>
          ))}
        </select>
      );
    case 'text':
      return field.multiline ? (
        <textarea
          aria-label={field.label}
          className={`${input} h-20 w-full resize-y py-1.5`}
          value={String(v ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : (
        <input
          aria-label={field.label}
          className={`${input} w-full`}
          value={String(v ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
  }
}
