import { LongPosition, makePositionDefinition } from '../position';

export const longPositionTool = makePositionDefinition('long', {
  id: 'long-position',
  label: 'Long Position',
  icon: 'M4 4h16v8H4zM4 12h16v8H4zM12 10V6M10 8l2-2 2 2',
  shortcut: 'Alt+Shift+L',
  create: (init) => new LongPosition('long-position', init),
});
