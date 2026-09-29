import type { ChartApp } from '../chart-app';
import type { ShortcutDefinition } from './shortcut-registry';

/** Replay shortcuts; registered first so they win while a replay is running. */
export const REPLAY_SHORTCUTS: ReadonlyArray<ShortcutDefinition<ChartApp>> = [
  {
    id: 'replay-step',
    keys: ['Shift+ArrowRight'],
    description: 'Step forward one bar',
    category: 'Replay',
    allowRepeat: true,
    when: (a) => a.replay.active,
    run: (a) => void a.replay.step(),
  },
  {
    id: 'replay-play',
    keys: ['Space'],
    description: 'Play / pause',
    category: 'Replay',
    when: (a) => a.replay.active,
    run: (a) => a.replay.togglePlay(),
  },
  {
    id: 'replay-cancel-select',
    keys: ['Escape'],
    description: 'Cancel start-bar selection',
    category: 'Replay',
    when: (a) => a.replay.state === 'selecting',
    run: (a) => a.replay.cancelSelecting(),
  },
];
