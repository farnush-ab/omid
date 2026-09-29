'use client';

import { LINE_STYLES, type LineStyle } from '@/lib/core';

export const LINE_WIDTHS = [1, 2, 3, 4, 6, 8] as const;

const DASH: Record<LineStyle, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '1.5 3',
};

export function LineStylePreview({
  style,
  width = 2,
}: {
  readonly style: LineStyle;
  readonly width?: number;
}) {
  return (
    <svg width="28" height="10" aria-hidden="true">
      <line
        x1="2"
        y1="5"
        x2="26"
        y2="5"
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={DASH[style]}
        strokeLinecap="round"
      />
    </svg>
  );
}

interface SegProps<T extends string | number> {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (v: T) => void;
  readonly render: (v: T) => React.ReactNode;
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
}: SegProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-line p-0.5"
    >
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          aria-label={`${label} ${o}`}
          onClick={() => onChange(o)}
          className={`flex h-7 min-w-8 items-center justify-center rounded px-1 text-xs ${o === value ? 'bg-hover text-accent' : 'text-fg hover:bg-hover'}`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function LineWidthControl({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (v: number) => void;
}) {
  return (
    <Segmented
      label="Line width"
      options={LINE_WIDTHS}
      value={
        (LINE_WIDTHS as readonly number[]).includes(value)
          ? (value as (typeof LINE_WIDTHS)[number])
          : 1
      }
      onChange={onChange}
      render={(w) => (
        <svg width="18" height="12" aria-hidden="true">
          <line
            x1="2"
            y1="6"
            x2="16"
            y2="6"
            stroke="currentColor"
            strokeWidth={Math.min(w, 6)}
            strokeLinecap="round"
          />
        </svg>
      )}
    />
  );
}

export function LineStyleControl({
  value,
  onChange,
}: {
  readonly value: LineStyle;
  readonly onChange: (v: LineStyle) => void;
}) {
  return (
    <Segmented
      label="Line style"
      options={LINE_STYLES}
      value={value}
      onChange={onChange}
      render={(s) => <LineStylePreview style={s} />}
    />
  );
}
