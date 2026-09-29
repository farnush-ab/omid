import type { ReactNode } from 'react';

interface TooltipProps {
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly side?: 'bottom' | 'right' | 'top';
  readonly children: ReactNode;
}

const SIDE = {
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const;

/** CSS-only tooltip (label + shortcut) shown on hover/focus after a short delay. */
export function Tooltip({ label, shortcut, side = 'bottom', children }: TooltipProps) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[70] whitespace-nowrap rounded-md bg-[#0b0e14f2] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity delay-0 duration-150 group-hover/tt:opacity-100 group-hover/tt:delay-300 group-focus-within/tt:opacity-100 ${SIDE[side]}`}
      >
        {label}
        {shortcut ? <span className="ml-2 text-[#9aa0ab]">{shortcut}</span> : null}
      </span>
    </span>
  );
}
