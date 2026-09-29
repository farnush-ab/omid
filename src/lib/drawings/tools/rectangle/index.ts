import type { DrawingToolDefinition } from '../../framework';
import { lineFields, textFields } from '../../framework';
import { Rectangle } from './rectangle';
import { RECTANGLE_DEFAULTS, rectangleStyleSchema, type RectangleStyle } from './style';

export const rectangleTool: DrawingToolDefinition<RectangleStyle> = {
  id: 'rectangle',
  label: 'Rectangle',
  icon: 'M4 6h16v12H4zM4 6h.01M20 18h.01',
  shortcut: 'Alt+Shift+R',
  placement: { kind: 'points', count: 2 },
  defaults: RECTANGLE_DEFAULTS,
  styleSchema: rectangleStyleSchema,
  toolbar: ['borderColor', 'fillColor', 'borderWidth', 'borderStyle'],
  pointLabels: ['Corner 1', 'Corner 2'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'shape',
            fields: [
              ...lineFields({
                color: 'borderColor',
                opacity: 'borderOpacity',
                width: 'borderWidth',
                style: 'borderStyle',
                label: 'Border',
              }),
              { kind: 'boolean', key: 'fillEnabled', label: 'Background' },
              {
                kind: 'color',
                key: 'fillColor',
                label: 'Fill',
                opacityKey: 'fillOpacity',
                inline: true,
              },
              { kind: 'boolean', key: 'extendLeft', label: 'Extend left' },
              { kind: 'boolean', key: 'extendRight', label: 'Extend right' },
            ],
          },
          {
            id: 'middle',
            label: 'Middle line',
            fields: [
              { kind: 'boolean', key: 'showMiddleLine', label: 'Show middle line' },
              ...lineFields({
                color: 'middleLineColor',
                opacity: 'middleLineOpacity',
                width: 'middleLineWidth',
                style: 'middleLineStyle',
              }).map((f) => ({ ...f, visibleWhen: { key: 'showMiddleLine', truthy: true } })),
            ],
          },
          {
            id: 'stats',
            label: 'Stats',
            fields: [
              { kind: 'boolean', key: 'showPriceRange', label: 'Price range' },
              { kind: 'boolean', key: 'showBarsRange', label: 'Bars range' },
            ],
          },
        ],
      },
      {
        id: 'text',
        label: 'Text',
        groups: [
          {
            id: 'text',
            fields: [
              ...textFields({ withAlign: 'textHAlign', withVAlign: 'textVAlign' }),
              { kind: 'boolean', key: 'textWrap', label: 'Wrap text' },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new Rectangle('rectangle', init),
};
