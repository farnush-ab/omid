import { ShortPosition, makePositionDefinition } from '../position';

export const shortPositionTool = makePositionDefinition('short', {
  id: 'short-position',
  label: 'Short Position',
  icon: 'M4 4h16v8H4zM4 12h16v8H4zM12 14v4M10 16l2 2 2-2',
  shortcut: 'Alt+Shift+S',
  create: (init) => new ShortPosition('short-position', init),
});
