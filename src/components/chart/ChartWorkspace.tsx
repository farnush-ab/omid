'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartApp, createBrowserDependencies } from '@/lib/app';
import { DialogHost } from '../dialogs/DialogHost';
import { useGlobalKeyboard } from '../hooks/useGlobalKeyboard';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { IntervalTyperOverlay } from '../overlays/IntervalTyperOverlay';
import { LoadingOverlay } from '../overlays/LoadingOverlay';
import { Toasts } from '../overlays/Toasts';
import { AppContext } from '../state/app-context';
import { connectBridge } from '../state/bridge';
import { ReplayBar } from '../replay/ReplayBar';
import { TopToolbar } from '../toolbar/TopToolbar';
import { ContextMenu } from '../drawing/ContextMenu';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import { FloatingToolbar } from '../drawing/FloatingToolbar';
import { TextEditorOverlay } from '../drawing/TextEditorOverlay';
import { ChartControls } from './ChartControls';
import { Legend } from './Legend';
import { VolumePaneControls } from './VolumePaneControls';

/** Reads optional URL overrides: ?provider=synthetic, ?bars=50000 (stress test). */
function urlOptions() {
  const p = new URLSearchParams(window.location.search);
  const provider = p.get('provider');
  const bars = Number(p.get('bars'));
  return {
    deps: provider ? { providerId: provider } : {},
    app:
      Number.isFinite(bars) && bars > 0 ? { initialBars: Math.min(200_000, Math.floor(bars)) } : {},
  };
}

/**
 * Client-only application shell. Creates the ChartApp in an effect and destroys it on unmount
 * (safe under React Strict Mode double-mounting). Chart state never enters React state.
 */
export default function ChartWorkspace() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<ChartApp | null>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const opts = urlOptions();
    const instance = new ChartApp(el, createBrowserDependencies(opts.deps), opts.app);
    const disconnect = connectBridge(instance);
    // Dev-only handle for debugging and the e2e performance script.
    if (process.env.NODE_ENV !== 'production')
      (window as unknown as { __chartApp?: ChartApp }).__chartApp = instance;
    setApp(instance);
    void instance.start();
    return () => {
      disconnect();
      instance.destroy();
      setApp(null);
    };
  }, []);

  useGlobalKeyboard(app);
  useThemeCssVars();

  return (
    <AppContext.Provider value={app}>
      <div className="flex h-full w-full flex-col bg-chart text-fg">
        {app ? <TopToolbar /> : <div className="h-10 shrink-0 border-b border-line bg-panel" />}
        <div className="flex min-h-0 flex-1">
          {app ? (
            <DrawingToolbar />
          ) : (
            <div className="w-12 shrink-0 border-r border-line bg-panel" />
          )}
          <main className="relative min-w-0 flex-1" aria-label="Chart">
            <div ref={chartRef} className="absolute inset-0" data-testid="chart" />
            {app ? (
              <>
                <Legend />
                <VolumePaneControls />
                <ChartControls />
                <FloatingToolbar />
                <TextEditorOverlay />
                <IntervalTyperOverlay />
              </>
            ) : null}
            <LoadingOverlay />
          </main>
        </div>
        {app ? <ReplayBar /> : null}
        {app ? (
          <>
            <DialogHost />
            <ContextMenu />
          </>
        ) : null}
        <Toasts />
      </div>
    </AppContext.Provider>
  );
}
