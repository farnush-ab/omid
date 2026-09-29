'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  readonly anchor: HTMLElement | null;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

const GAP = 6;
const MARGIN = 8;

/** Fixed-position popover portalled to <body>, clamped to the viewport. */
export function Popover({ anchor, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const p = ref.current.getBoundingClientRect();
    let top = a.bottom + GAP;
    if (top + p.height > window.innerHeight - MARGIN)
      top = Math.max(MARGIN, a.top - p.height - GAP);
    const left = Math.min(Math.max(MARGIN, a.left), window.innerWidth - p.width - MARGIN);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className="fixed z-[65] animate-pop rounded-lg border border-line bg-panel p-3 text-fg shadow-2xl"
    >
      {children}
    </div>,
    document.body,
  );
}
