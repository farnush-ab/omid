import { drawingRegistry } from '@/lib/drawings';
import type { ChartApp } from '../chart-app';
import type { ShortcutDefinition } from './shortcut-registry';

const NUDGE_PX = 4;
const BIG = 10;

const hasSelection = (a: ChartApp) => a.drawings.selected !== null;

/** Drawing-related shortcuts. Tool shortcuts come straight from the tool definitions. */
export function drawingShortcuts(): ShortcutDefinition<ChartApp>[] {
  const tools: ShortcutDefinition<ChartApp>[] = drawingRegistry
    .list()
    .filter((d) => d.shortcut)
    .map((d) => ({
      id: `tool:${d.id}`,
      keys: [d.shortcut!],
      description: d.label,
      category: 'Drawing tools',
      run: (a) => a.drawings.setTool(a.drawings.tool === d.id ? null : d.id),
    }));
  const nudge = (
    id: string,
    keys: string[],
    desc: string,
    dBars: number,
    dy: number,
  ): ShortcutDefinition<ChartApp> => ({
    id,
    keys,
    description: desc,
    category: 'Drawings',
    allowRepeat: true,
    when: hasSelection,
    run: (a) => a.drawings.nudge(dBars, dy),
  });
  return [
    ...tools,
    {
      id: 'escape',
      keys: ['Escape'],
      description: 'Cancel tool / finish path / deselect',
      category: 'Drawings',
      when: (a) => a.drawings.tool !== null || a.drawings.selected !== null || a.drawings.isBusy,
      run: (a) => a.drawings.escape(),
    },
    {
      id: 'confirm',
      keys: ['Enter'],
      description: 'Finish path',
      category: 'Drawings',
      when: (a) => a.drawings.isBusy,
      run: (a) => a.drawings.confirm(),
    },
    {
      id: 'delete',
      keys: ['Delete', 'Backspace'],
      description: 'Remove selected drawing',
      category: 'Drawings',
      when: hasSelection,
      run: (a) => a.drawings.removeSelected(),
    },
    {
      id: 'copy',
      keys: ['Ctrl+C'],
      description: 'Copy drawing',
      category: 'Drawings',
      when: hasSelection,
      run: (a) => a.drawings.copySelected(),
    },
    {
      id: 'paste',
      keys: ['Ctrl+V'],
      description: 'Paste drawing',
      category: 'Drawings',
      run: (a) => a.drawings.paste(),
    },
    {
      id: 'duplicate',
      keys: ['Ctrl+D'],
      description: 'Duplicate drawing',
      category: 'Drawings',
      when: hasSelection,
      run: (a) => void a.drawings.clone(a.drawings.selected!.id, 3),
    },
    nudge('nudge-left', ['ArrowLeft'], 'Nudge left (Shift = ×10)', -1, 0),
    nudge('nudge-right', ['ArrowRight'], 'Nudge right', 1, 0),
    nudge('nudge-up', ['ArrowUp'], 'Nudge up', 0, -NUDGE_PX),
    nudge('nudge-down', ['ArrowDown'], 'Nudge down', 0, NUDGE_PX),
    nudge('nudge-left-big', ['Shift+ArrowLeft'], 'Nudge left ×10', -BIG, 0),
    nudge('nudge-right-big', ['Shift+ArrowRight'], 'Nudge right ×10', BIG, 0),
    nudge('nudge-up-big', ['Shift+ArrowUp'], 'Nudge up ×10', 0, -NUDGE_PX * BIG),
    nudge('nudge-down-big', ['Shift+ArrowDown'], 'Nudge down ×10', 0, NUDGE_PX * BIG),
    {
      id: 'magnet',
      keys: ['Alt+M'],
      description: 'Cycle magnet (off → weak → strong); hold Ctrl to toggle temporarily',
      category: 'Drawings',
      run: (a) =>
        a.drawings.setMagnet(
          ({ off: 'weak', weak: 'strong', strong: 'off' } as const)[a.drawings.modes.magnet],
        ),
    },
    {
      id: 'hide-all',
      keys: ['Ctrl+Alt+H'],
      description: 'Hide / show all drawings',
      category: 'Drawings',
      run: (a) => a.drawings.setModes({ hideAll: !a.drawings.modes.hideAll }),
    },
    {
      id: 'lock-all',
      keys: ['Ctrl+Alt+L'],
      description: 'Lock / unlock all drawings',
      category: 'Drawings',
      run: (a) => a.drawings.setModes({ lockAll: !a.drawings.modes.lockAll }),
    },
  ];
}
