'use client';

import { chordLabel } from '@/lib/app';
import { TIMEFRAMES, bucketStart, formatDateTime } from '@/lib/core';
import { REPLAY_SPEEDS, type ReplaySpeed } from '@/lib/replay';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Divider } from '../ui/Divider';
import { IconButton } from '../ui/IconButton';

/** Bottom replay control bar (visible while selecting or replaying). */
export function ReplayBar() {
  const app = useApp();
  const r = useUiStore((s) => s.replay);
  const timeframe = useUiStore((s) => s.timeframe);
  if (r.state === 'idle' || r.state === 'exited') return null;

  if (r.state === 'selecting') {
    return (
      <div
        role="region"
        aria-label="Bar replay"
        className="flex h-11 shrink-0 animate-fade items-center gap-3 border-t border-line bg-panel px-3 text-[13px]"
      >
        <span className="text-muted">Click a bar on the chart to start the replay from it.</span>
        <div className="flex-1" />
        <Button onClick={() => app.replay.cancelSelecting()}>Cancel</Button>
      </div>
    );
  }

  const playing = r.state === 'playing';
  const tf = TIMEFRAMES[timeframe];
  return (
    <div
      role="region"
      aria-label="Bar replay controls"
      className="flex h-11 shrink-0 animate-fade items-center gap-1 overflow-x-auto border-t border-line bg-panel px-2 text-[13px]"
    >
      <IconButton
        icon="scissors"
        label="Select bar"
        tooltipSide="top"
        onClick={() => app.replay.startSelecting()}
      />
      <Divider />
      <IconButton
        icon={playing ? 'pause' : 'play'}
        label={playing ? 'Pause' : 'Play'}
        shortcut="Space"
        tooltipSide="top"
        disabled={r.atEnd && !playing}
        onClick={() => app.replay.togglePlay()}
      />
      <IconButton
        icon="stepForward"
        label="Step forward"
        shortcut={chordLabel('Shift+ArrowRight')}
        tooltipSide="top"
        disabled={r.atEnd}
        onClick={() => void app.replay.step()}
      />
      <label className="flex items-center gap-1 px-1 text-muted">
        <span className="sr-only">Speed</span>
        <select
          aria-label="Replay speed"
          value={r.speed}
          onChange={(e) => app.replay.setSpeed(Number(e.target.value) as ReplaySpeed)}
          className="h-8 rounded-md border border-line bg-panel px-1.5 text-fg"
        >
          {REPLAY_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </label>
      <IconButton
        icon="jumpEnd"
        label="Jump to end"
        tooltipSide="top"
        disabled={r.atEnd}
        onClick={() => app.replay.jumpToEnd()}
      />
      <Divider />
      <span className="whitespace-nowrap px-1 tabular-nums text-muted" aria-live="polite">
        {r.cursorTime !== null
          ? formatDateTime(
              bucketStart(r.cursorTime - 1, r.baseTimeframe ?? timeframe),
              tf.dateOnly,
              !tf.dateOnly,
            )
          : ''}
        {r.baseTimeframe && r.baseTimeframe !== timeframe
          ? ` · building from ${TIMEFRAMES[r.baseTimeframe].label}`
          : ''}
        {r.atEnd ? ' · end of data' : ''}
        {r.loading ? ' · loading…' : ''}
      </span>
      <div className="flex-1" />
      <Button onClick={() => app.replay.exit()}>Exit replay</Button>
    </div>
  );
}
