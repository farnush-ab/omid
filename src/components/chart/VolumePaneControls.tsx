'use client';

import { chordLabel } from '@/lib/app';
import { ENGINE_CONFIG } from '@/lib/core';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { IconButton } from '../ui/IconButton';

const TIME_AXIS_H = ENGINE_CONFIG.timeAxis.height;

/** Hide control aligned with the volume histogram pane (TradingView-style). */
export function VolumePaneControls() {
  const app = useApp();
  const opts = useUiStore((s) => s.options);
  if (!opts.volumeVisible) return null;

  const ratio = opts.volumePaneRatio;
  return (
    <div
      className="group/vol absolute left-0 z-10 flex w-[calc(100%-72px)] items-center pl-0.5"
      style={{
        bottom: TIME_AXIS_H,
        height: `calc((100% - ${TIME_AXIS_H}px) * ${ratio})`,
      }}
    >
      <IconButton
        icon="eyeOff"
        label="Hide volume pane"
        shortcut={chordLabel('Alt+V')}
        tooltipSide="top"
        className="h-7 w-7 opacity-0 transition-opacity group-hover/vol:opacity-100 focus-visible:opacity-100"
        onClick={() => app.settings.toggle('volumeVisible')}
      />
    </div>
  );
}
