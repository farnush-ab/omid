import type { ChartApp } from '../chart-app';
import type { ShortcutDefinition } from './shortcut-registry';

const SCROLL_BARS = 5;
const ZOOM_STEP = 1.25;

/** Built-in app/chart shortcuts. Drawing-tool and replay shortcuts are added by their modules. */
export const DEFAULT_SHORTCUTS: ReadonlyArray<ShortcutDefinition<ChartApp>> = [
  {
    id: 'undo',
    keys: ['Ctrl+Z'],
    description: 'Undo',
    category: 'General',
    allowRepeat: true,
    run: (a) => a.history.undo(),
  },
  {
    id: 'redo',
    keys: ['Ctrl+Y', 'Ctrl+Shift+Z'],
    description: 'Redo',
    category: 'General',
    allowRepeat: true,
    run: (a) => a.history.redo(),
  },
  {
    id: 'symbol-search',
    keys: ['Ctrl+K'],
    description: 'Symbol search (or just start typing a symbol)',
    category: 'General',
    run: (a) => a.events.emit('ui:command', { type: 'open-symbol-search' }),
  },
  {
    id: 'settings',
    keys: ['Ctrl+,'],
    description: 'Chart settings',
    category: 'General',
    run: (a) => a.events.emit('ui:command', { type: 'open-settings' }),
  },
  {
    id: 'shortcuts',
    keys: ['?'],
    description: 'Keyboard shortcuts',
    category: 'General',
    run: (a) => a.events.emit('ui:command', { type: 'open-shortcuts' }),
  },
  {
    id: 'reset-chart',
    keys: ['Alt+R'],
    description: 'Reset chart view',
    category: 'Chart',
    run: (a) => a.engine.resetView(),
  },
  {
    id: 'jump-latest',
    keys: ['End'],
    description: 'Jump to the latest bar',
    category: 'Chart',
    run: (a) => a.engine.scrollToLatest(true),
  },
  {
    id: 'auto-scale',
    keys: ['Alt+A'],
    description: 'Toggle auto scale',
    category: 'Chart',
    run: (a) => a.settings.toggle('autoScale'),
  },
  {
    id: 'log-scale',
    keys: ['Alt+L'],
    description: 'Toggle log scale',
    category: 'Chart',
    run: (a) => a.settings.toggleScaleMode('log'),
  },
  {
    id: 'percent-scale',
    keys: ['Alt+P'],
    description: 'Toggle percent scale',
    category: 'Chart',
    run: (a) => a.settings.toggleScaleMode('percent'),
  },
  {
    id: 'invert-scale',
    keys: ['Alt+I'],
    description: 'Invert scale',
    category: 'Chart',
    run: (a) => a.settings.toggle('invertScale'),
  },
  {
    id: 'toggle-volume',
    keys: ['Alt+V'],
    description: 'Toggle volume pane',
    category: 'Chart',
    run: (a) => a.settings.toggle('volumeVisible'),
  },
  {
    id: 'scroll-left',
    keys: ['ArrowLeft'],
    description: 'Scroll left',
    category: 'Chart',
    allowRepeat: true,
    when: (a) => !a.hasSelection(),
    run: (a) => a.engine.scrollBars(-SCROLL_BARS),
  },
  {
    id: 'scroll-right',
    keys: ['ArrowRight'],
    description: 'Scroll right',
    category: 'Chart',
    allowRepeat: true,
    when: (a) => !a.hasSelection(),
    run: (a) => a.engine.scrollBars(SCROLL_BARS),
  },
  {
    id: 'zoom-in',
    keys: ['Ctrl+ArrowUp'],
    description: 'Zoom in',
    category: 'Chart',
    allowRepeat: true,
    run: (a) => a.engine.zoom(ZOOM_STEP),
  },
  {
    id: 'zoom-out',
    keys: ['Ctrl+ArrowDown'],
    description: 'Zoom out',
    category: 'Chart',
    allowRepeat: true,
    run: (a) => a.engine.zoom(1 / ZOOM_STEP),
  },
];
