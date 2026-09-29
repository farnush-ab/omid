'use client';

import { useState } from 'react';
import { alphaOf, toHex6, toHex8, withOpacity } from '@/lib/core';
import { Popover } from '../ui/Popover';

const PALETTE = [
  '#ffffff',
  '#d1d4dc',
  '#b2b5be',
  '#9598a1',
  '#787b86',
  '#5d606b',
  '#434651',
  '#2a2e39',
  '#131722',
  '#000000',
  '#f23645',
  '#ff9800',
  '#ffeb3b',
  '#4caf50',
  '#089981',
  '#00bcd4',
  '#2962ff',
  '#673ab7',
  '#9c27b0',
  '#e91e63',
  '#fccbcd',
  '#ffe0b2',
  '#fff9c4',
  '#c8e6c9',
  '#ace5dc',
  '#b2ebf2',
  '#bbd9fb',
  '#d1c4e9',
  '#e1bee7',
  '#f8bbd0',
  '#f7525f',
  '#ffb74d',
  '#fff176',
  '#81c784',
  '#22ab94',
  '#4dd0e1',
  '#5b9cf6',
  '#9575cd',
  '#ba68c8',
  '#f06292',
  '#b22833',
  '#e65100',
  '#f57f17',
  '#1b5e20',
  '#056656',
  '#006064',
  '#0c3299',
  '#311b92',
  '#4a148c',
  '#880e4f',
];

interface ColorPickerProps {
  readonly color: string;
  /** Separate opacity (0..1). When undefined, alpha is stored in the colour itself (#rrggbbaa). */
  readonly opacity?: number | undefined;
  readonly onChange: (color: string, opacity: number) => void;
  readonly label: string;
  readonly size?: 'sm' | 'md';
}

/** Swatch button + palette/custom/opacity popover (TradingView-like). */
export function ColorPicker({ color, opacity, onChange, label, size = 'md' }: ColorPickerProps) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const embedded = opacity === undefined;
  const alpha = embedded ? alphaOf(color) : opacity;
  const emit = (hex6: string, a: number) =>
    onChange(embedded ? toHex8(withOpacity(hex6, a)) : hex6, a);
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={`${label} colour`}
        onClick={() => setOpen((v) => !v)}
        className={`${dim} shrink-0 rounded-md border border-line bg-[repeating-conic-gradient(#8884_0_25%,transparent_0_50%)] bg-[length:8px_8px] p-0.5 hover:border-muted`}
      >
        <span
          className="block h-full w-full rounded"
          style={{ background: withOpacity(color, embedded ? 1 : alpha) }}
        />
      </button>
      {open ? (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div className="grid grid-cols-10 gap-1" role="listbox" aria-label={`${label} palette`}>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => emit(c, alpha)}
                className={`h-5 w-5 rounded border ${toHex6(color) === c ? 'border-accent ring-1 ring-accent' : 'border-line'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <input
              type="color"
              aria-label="Custom colour"
              value={toHex6(color)}
              onChange={(e) => emit(e.target.value, alpha)}
              className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent"
            />
            <input
              aria-label="Hex"
              defaultValue={toHex6(color)}
              key={toHex6(color)}
              onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && emit(e.target.value, alpha)}
              className="h-7 w-20 rounded border border-line bg-transparent px-1.5 font-mono"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted">
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(alpha * 100)}
              onChange={(e) => emit(toHex6(color), Number(e.target.value) / 100)}
              className="flex-1"
            />
            <span className="w-9 text-right tabular-nums text-fg">{Math.round(alpha * 100)}%</span>
          </label>
        </Popover>
      ) : null}
    </>
  );
}
