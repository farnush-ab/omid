import type { DrawingToolDefinition } from '../../framework';
import { LINE_END_OPTIONS, H_ALIGN_OPTIONS, lineFields, textFields } from '../../framework';
import { TREND_LINE_DEFAULTS, trendLineStyleSchema, type TrendLineStyle } from './style';
import { TrendLine } from './trend-line';

export const trendLineTool: DrawingToolDefinition<TrendLineStyle> = {
  id: 'trend-line',
  label: 'Trend Line',
  icon: 'M3 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M17 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0M6.5 17.5l11-11',
  shortcut: 'Alt+T',
  placement: { kind: 'points', count: 2 },
  defaults: TREND_LINE_DEFAULTS,
  styleSchema: trendLineStyleSchema,
  themeDefaults: { color: 'drawingLine' },
  angleConstraint: true,
  toolbar: ['color', 'lineWidth', 'lineStyle'],
  pointLabels: ['Start', 'End'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'line',
            fields: [
              ...lineFields({
                color: 'color',
                opacity: 'opacity',
                width: 'lineWidth',
                style: 'lineStyle',
              }),
              { kind: 'boolean', key: 'extendLeft', label: 'Extend left' },
              { kind: 'boolean', key: 'extendRight', label: 'Extend right' },
              { kind: 'select', key: 'startEnd', label: 'Line start', options: LINE_END_OPTIONS },
              { kind: 'select', key: 'endEnd', label: 'Line end', options: LINE_END_OPTIONS },
              { kind: 'boolean', key: 'showMiddlePoint', label: 'Middle point' },
            ],
          },
          {
            id: 'stats',
            label: 'Stats',
            fields: [
              { kind: 'boolean', key: 'showPriceRange', label: 'Price range' },
              { kind: 'boolean', key: 'showPercentChange', label: 'Percent change' },
              { kind: 'boolean', key: 'showBarsRange', label: 'Bars range' },
              { kind: 'boolean', key: 'showDateRange', label: 'Date/time range' },
              { kind: 'boolean', key: 'showDistance', label: 'Distance' },
              { kind: 'boolean', key: 'showAngle', label: 'Angle' },
              {
                kind: 'select',
                key: 'statsPosition',
                label: 'Stats position',
                options: H_ALIGN_OPTIONS,
              },
              { kind: 'boolean', key: 'alwaysShowStats', label: 'Always show stats' },
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
            fields: textFields({ withAlign: 'textAlign', withVAlign: 'textPosition' }),
          },
        ],
      },
    ],
  },
  create: (init) => new TrendLine('trend-line', init),
};
