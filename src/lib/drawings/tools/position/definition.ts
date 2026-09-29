import { roundToStep, type SymbolInfo } from '@/lib/core';
import type { ChartPoint, DrawingToolDefinition, SerializedDrawing } from '../../framework';
import type { PositionTool } from './position-tool';
import type { Side } from './position-math';
import { POSITION_DEFAULTS, positionStyleSchema, type PositionStyle } from './style';

/** Default size of a freshly placed position, relative to the visible area. */
const PLACE = { targetOfSpan: 0.1, stopOfSpan: 0.05, widthOfVisible: 0.15, minBars: 12 };

const DERIVED_KEYS = [
  'entryPrice',
  'profitPrice',
  'profitTicks',
  'profitPercent',
  'stopPrice',
  'stopTicks',
  'stopPercent',
] as const;

function levelsOf(s: SerializedDrawing): { entry: number; target: number; stop: number } {
  return {
    entry: s.points[0]?.price ?? 0,
    target: s.points[1]?.price ?? 0,
    stop: s.points[2]?.price ?? 0,
  };
}

function withLevels(
  s: SerializedDrawing,
  entry: number,
  target: number,
  stop: number,
  tick: number,
): SerializedDrawing {
  const [e, t, st] = s.points;
  if (!e || !t || !st) return s;
  return {
    ...s,
    points: [
      { time: e.time, price: roundToStep(entry, tick) },
      { time: t.time, price: roundToStep(target, tick) },
      { time: t.time, price: roundToStep(stop, tick) },
    ],
  };
}

/** Builds the tool definition for one side; Long and Short differ only by `side` and labels. */
export function makePositionDefinition(
  side: Side,
  meta: {
    id: string;
    label: string;
    icon: string;
    shortcut: string;
    create: (init: ConstructorParameters<typeof PositionTool>[1]) => PositionTool;
  },
): DrawingToolDefinition<PositionStyle> {
  const up = side === 'long' ? 1 : -1;
  const derivedGet = (s: SerializedDrawing, sym: SymbolInfo) => {
    const { entry, target, stop } = levelsOf(s);
    const pct = (d: number) => Number(((d / entry) * 100).toFixed(3));
    return {
      entryPrice: entry,
      profitPrice: target,
      profitTicks: Math.round(Math.abs(target - entry) / sym.tickSize),
      profitPercent: pct(Math.abs(target - entry)),
      stopPrice: stop,
      stopTicks: Math.round(Math.abs(entry - stop) / sym.tickSize),
      stopPercent: pct(Math.abs(entry - stop)),
    };
  };
  const derivedSet = (
    s: SerializedDrawing,
    key: string,
    raw: unknown,
    sym: SymbolInfo,
  ): SerializedDrawing => {
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) return s;
    const tick = sym.tickSize;
    const { entry, target, stop } = levelsOf(s);
    const clampT = (t: number, e: number) => (up * (t - e) >= tick ? t : e + up * tick);
    const clampS = (st: number, e: number) => (up * (e - st) >= tick ? st : e - up * tick);
    switch (key) {
      case 'entryPrice': {
        // Moving the entry keeps the distances to target and stop.
        const e = v;
        return withLevels(s, e, e + (target - entry), e - (entry - stop), tick);
      }
      case 'profitPrice':
        return withLevels(s, entry, clampT(v, entry), stop, tick);
      case 'profitTicks':
        return withLevels(s, entry, clampT(entry + up * v * tick, entry), stop, tick);
      case 'profitPercent':
        return withLevels(s, entry, clampT(entry * (1 + (up * v) / 100), entry), stop, tick);
      case 'stopPrice':
        return withLevels(s, entry, target, clampS(v, entry), tick);
      case 'stopTicks':
        return withLevels(s, entry, target, clampS(entry - up * v * tick, entry), tick);
      case 'stopPercent':
        return withLevels(s, entry, target, clampS(entry * (1 - (up * v) / 100), entry), tick);
      default:
        return s;
    }
  };

  return {
    id: meta.id,
    label: meta.label,
    icon: meta.icon,
    shortcut: meta.shortcut,
    placement: { kind: 'single' },
    defaults: POSITION_DEFAULTS,
    styleSchema: positionStyleSchema,
    toolbar: ['profitColor', 'lossColor', 'lineWidth'],
    pointLabels: ['Entry', 'Target / end time', 'Stop'],
    coordinateFields: [['time', 'price'], ['time', 'price'], ['price']],
    derivedFields: { keys: DERIVED_KEYS, get: derivedGet, set: derivedSet },
    normalizePoints(points: readonly ChartPoint[]): ChartPoint[] {
      const [e, t, s] = points;
      if (!e || !t || !s) return [...points];
      const end = Math.max(t.time, e.time + 1);
      return [e, { time: end, price: t.price }, { time: end, price: s.price }];
    },
    finalizePoints(points, dc) {
      if (points.length >= 3) return [...points];
      const p = points[0]!;
      const tick = dc.symbol.tickSize;
      const c = dc.coords;
      const span = Math.abs(c.yToPrice(dc.pane.y) - c.yToPrice(dc.pane.y + dc.pane.height));
      const visibleBars = dc.pane.width / c.barSpacing;
      const bars = Math.max(PLACE.minBars, Math.round(visibleBars * PLACE.widthOfVisible));
      const end = c.indexToTime(Math.round(c.timeToIndex(p.time)) + bars);
      const entry = roundToStep(p.price, tick);
      const target = roundToStep(entry + up * Math.max(tick, span * PLACE.targetOfSpan), tick);
      const stop = roundToStep(entry - up * Math.max(tick, span * PLACE.stopOfSpan), tick);
      return [
        { time: p.time, price: entry },
        { time: end, price: target },
        { time: end, price: stop },
      ];
    },
    settings: {
      tabs: [
        {
          id: 'inputs',
          label: 'Inputs',
          groups: [
            {
              id: 'account',
              label: 'Account',
              fields: [
                { kind: 'number', key: 'accountSize', label: 'Account size', min: 0, step: 100 },
                { kind: 'number', key: 'lotSize', label: 'Lot size', min: 0.00000001, step: 1 },
                {
                  kind: 'select',
                  key: 'riskMode',
                  label: 'Risk',
                  options: [
                    { value: 'percent', label: '% of account' },
                    { value: 'amount', label: 'Amount' },
                  ],
                },
                { kind: 'number', key: 'risk', label: 'Value', min: 0, step: 0.1, inline: true },
                {
                  kind: 'number',
                  key: 'leverage',
                  label: 'Leverage',
                  min: 1,
                  max: 1000,
                  step: 1,
                  unit: '×',
                },
              ],
            },
            {
              id: 'levels',
              label: 'Levels',
              fields: [
                { kind: 'number', key: 'entryPrice', label: 'Entry price', min: 0, step: 0.0001 },
                {
                  kind: 'number',
                  key: 'profitPrice',
                  label: 'Profit level',
                  min: 0,
                  step: 0.0001,
                  unit: 'price',
                },
                {
                  kind: 'number',
                  key: 'profitTicks',
                  label: 'Ticks',
                  min: 1,
                  step: 1,
                  inline: true,
                },
                {
                  kind: 'number',
                  key: 'profitPercent',
                  label: '%',
                  min: 0,
                  step: 0.1,
                  inline: true,
                },
                {
                  kind: 'number',
                  key: 'stopPrice',
                  label: 'Stop level',
                  min: 0,
                  step: 0.0001,
                  unit: 'price',
                },
                { kind: 'number', key: 'stopTicks', label: 'Ticks', min: 1, step: 1, inline: true },
                { kind: 'number', key: 'stopPercent', label: '%', min: 0, step: 0.1, inline: true },
              ],
            },
          ],
        },
        {
          id: 'style',
          label: 'Style',
          groups: [
            {
              id: 'zones',
              label: 'Zones & lines',
              fields: [
                {
                  kind: 'color',
                  key: 'profitColor',
                  label: 'Profit zone',
                  opacityKey: 'profitOpacity',
                },
                { kind: 'color', key: 'lossColor', label: 'Stop zone', opacityKey: 'lossOpacity' },
                { kind: 'color', key: 'lineColor', label: 'Entry line' },
                { kind: 'lineWidth', key: 'lineWidth', label: 'Line width' },
              ],
            },
            {
              id: 'labels',
              label: 'Labels',
              fields: [
                { kind: 'color', key: 'profitLabelColor', label: 'Profit label' },
                { kind: 'color', key: 'lossLabelColor', label: 'Stop label' },
                { kind: 'color', key: 'textColor', label: 'Text' },
                { kind: 'boolean', key: 'showPriceLabels', label: 'Show price labels' },
                { kind: 'boolean', key: 'compact', label: 'Compact stats mode' },
                { kind: 'boolean', key: 'alwaysShowStats', label: 'Always show stats' },
              ],
            },
          ],
        },
      ],
    },
    create: meta.create,
  };
}
