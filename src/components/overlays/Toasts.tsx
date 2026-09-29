'use client';

import { useEffect } from 'react';
import { useUiStore, type Toast } from '../state/ui-store';

const TOAST_MS = 4500;

function ToastItem({ toast }: { readonly toast: Toast }) {
  const dismiss = useUiStore((s) => s.dismissToast);
  useEffect(() => {
    const h = window.setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => window.clearTimeout(h);
  }, [toast.id, dismiss]);
  return (
    <div
      role="status"
      className={`pointer-events-auto animate-pop rounded-lg border px-3 py-2 text-[13px] shadow-xl ${
        toast.kind === 'error'
          ? 'border-down/50 bg-panel text-down'
          : 'border-line bg-panel text-fg'
      }`}
      onClick={() => dismiss(toast.id)}
    >
      {toast.message}
    </div>
  );
}

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-14 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
