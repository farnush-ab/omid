'use client';

import { useUiStore } from '../state/ui-store';

export function LoadingOverlay() {
  const loading = useUiStore((s) => s.loading);
  const history = useUiStore((s) => s.historyLoading);
  return (
    <>
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent"
            aria-label="Loading"
          />
        </div>
      ) : null}
      {history ? (
        <div
          className="pointer-events-none absolute left-2 top-1/2 z-20 h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
          aria-label="Loading history"
        />
      ) : null}
    </>
  );
}
