'use client';

import { chordLabel } from '@/lib/app';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { IconButton } from '../ui/IconButton';

const ZOOM = 1.25;
const SCROLL = 10;

/** Hover navigation cluster + "jump to latest" + scale-mode toggles (TradingView-style). */
export function ChartControls() {
  const app = useApp();
  const atLatest = useUiStore((s) => s.atLatest);
  const opts = useUiStore((s) => s.options);
  const toggleCls = (on: boolean) =>
    `h-6 rounded px-1.5 text-[11px] font-semibold transition-colors hover:bg-hover ${on ? 'text-accent' : 'text-muted'}`;
  return (
    <>
      <div className="group/nav absolute bottom-10 left-1/2 z-10 flex h-14 w-72 -translate-x-1/2 items-end justify-center">
        <div className="flex gap-1 rounded-lg border border-line bg-panel/90 p-0.5 opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover/nav:opacity-100 focus-within:opacity-100">
          <IconButton
            icon="minus"
            label="Zoom out"
            shortcut={chordLabel('Ctrl+ArrowDown')}
            tooltipSide="top"
            onClick={() => app.engine.zoom(1 / ZOOM)}
          />
          <IconButton
            icon="plus"
            label="Zoom in"
            shortcut={chordLabel('Ctrl+ArrowUp')}
            tooltipSide="top"
            onClick={() => app.engine.zoom(ZOOM)}
          />
          <IconButton
            icon="chevronLeft"
            label="Scroll left"
            shortcut="←"
            tooltipSide="top"
            onClick={() => app.engine.scrollBars(-SCROLL)}
          />
          <IconButton
            icon="chevronRight"
            label="Scroll right"
            shortcut="→"
            tooltipSide="top"
            onClick={() => app.engine.scrollBars(SCROLL)}
          />
          <IconButton
            icon="reset"
            label="Reset chart view"
            shortcut={chordLabel('Alt+R')}
            tooltipSide="top"
            onClick={() => app.engine.resetView()}
          />
        </div>
      </div>
      {!atLatest ? (
        <div className="absolute bottom-9 right-[76px] z-10 animate-pop">
          <IconButton
            icon="toLatest"
            label="Scroll to the most recent bar"
            shortcut="End"
            tooltipSide="top"
            className="border border-line bg-panel shadow-lg"
            onClick={() => app.engine.scrollToLatest(true)}
          />
        </div>
      ) : null}
      <div className="absolute bottom-0.5 right-1 z-10 flex gap-0.5 rounded bg-chart">
        <button
          type="button"
          className={toggleCls(opts.scaleMode === 'percent')}
          title={`Percent scale (${chordLabel('Alt+P')})`}
          onClick={() => app.settings.toggleScaleMode('percent')}
        >
          %
        </button>
        <button
          type="button"
          className={toggleCls(opts.scaleMode === 'log')}
          title={`Log scale (${chordLabel('Alt+L')})`}
          onClick={() => app.settings.toggleScaleMode('log')}
        >
          log
        </button>
        <button
          type="button"
          className={toggleCls(opts.autoScale)}
          title={`Auto scale (${chordLabel('Alt+A')})`}
          onClick={() => app.settings.toggle('autoScale')}
        >
          auto
        </button>
      </div>
    </>
  );
}
