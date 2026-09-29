import type { SettingsSchema } from '@/lib/core';

/**
 * The chart settings dialog, declared as data. Keys prefixed `opt.` bind to ChartOptions,
 * `theme.` to colours of the active theme. The UI renders this with the generic SchemaForm.
 */
export const CHART_SETTINGS_SCHEMA: SettingsSchema = {
  tabs: [
    {
      id: 'symbol',
      label: 'Symbol',
      groups: [
        {
          id: 'candles',
          label: 'Candles',
          fields: [
            { kind: 'boolean', key: 'opt.showBody', label: 'Body' },
            { kind: 'color', key: 'theme.upBody', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.downBody', label: 'Down', inline: true },
            { kind: 'boolean', key: 'opt.showBorders', label: 'Borders' },
            { kind: 'color', key: 'theme.upBorder', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.downBorder', label: 'Down', inline: true },
            { kind: 'boolean', key: 'opt.showWicks', label: 'Wick' },
            { kind: 'color', key: 'theme.upWick', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.downWick', label: 'Down', inline: true },
          ],
        },
        {
          id: 'data',
          label: 'Data modification',
          fields: [
            {
              kind: 'select',
              key: 'opt.pricePrecision',
              label: 'Precision',
              options: [
                { value: -1, label: 'Default' },
                ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
                  value: n,
                  label: n === 0 ? '1' : `1/${10 ** n}`,
                })),
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'status',
      label: 'Status line',
      groups: [
        {
          id: 'status',
          fields: [
            { kind: 'boolean', key: 'opt.showStatusSymbol', label: 'Title' },
            { kind: 'boolean', key: 'opt.showStatusOHLC', label: 'OHLC values' },
            { kind: 'boolean', key: 'opt.showStatusChange', label: 'Bar change values' },
            { kind: 'boolean', key: 'opt.showStatusVolume', label: 'Volume' },
          ],
        },
      ],
    },
    {
      id: 'scales',
      label: 'Scales',
      groups: [
        {
          id: 'price-scale',
          label: 'Price scale',
          fields: [
            { kind: 'boolean', key: 'opt.autoScale', label: 'Auto (fits data to screen)' },
            {
              kind: 'select',
              key: 'opt.scaleMode',
              label: 'Scale type',
              options: [
                { value: 'linear', label: 'Regular' },
                { value: 'percent', label: 'Percent' },
                { value: 'log', label: 'Logarithmic' },
              ],
            },
            { kind: 'boolean', key: 'opt.invertScale', label: 'Invert scale' },
            { kind: 'boolean', key: 'opt.lockScale', label: 'Lock price to bar ratio' },
            { kind: 'boolean', key: 'opt.scalePriceChartOnly', label: 'Scale price chart only' },
          ],
        },
        {
          id: 'labels',
          label: 'Labels & lines',
          fields: [
            { kind: 'boolean', key: 'opt.showLastPriceLabel', label: 'Last price label' },
            { kind: 'boolean', key: 'opt.showLastPriceLine', label: 'Last price line' },
            { kind: 'boolean', key: 'opt.showPrevCloseLine', label: 'Previous day close line' },
            { kind: 'color', key: 'theme.prevCloseLine', label: 'Color', inline: true },
          ],
        },
      ],
    },
    {
      id: 'appearance',
      label: 'Appearance',
      groups: [
        {
          id: 'background',
          label: 'Chart basic styles',
          fields: [
            {
              kind: 'select',
              key: 'opt.backgroundType',
              label: 'Background',
              options: [
                { value: 'solid', label: 'Solid' },
                { value: 'gradient', label: 'Gradient' },
              ],
            },
            { kind: 'color', key: 'theme.background', label: 'Color', inline: true },
            {
              kind: 'color',
              key: 'theme.backgroundGradientEnd',
              label: 'To',
              inline: true,
              visibleWhen: { key: 'opt.backgroundType', equals: 'gradient' },
            },
            { kind: 'boolean', key: 'opt.gridVertical', label: 'Vert grid lines' },
            { kind: 'boolean', key: 'opt.gridHorizontal', label: 'Horz grid lines' },
            { kind: 'color', key: 'theme.grid', label: 'Grid color' },
            { kind: 'color', key: 'theme.scaleBorder', label: 'Scale lines' },
            { kind: 'color', key: 'theme.text', label: 'Scale text' },
            { kind: 'fontSize', key: 'opt.fontSize', label: 'Font size', inline: true },
          ],
        },
        {
          id: 'crosshair',
          label: 'Crosshair',
          fields: [
            {
              kind: 'select',
              key: 'opt.crosshairMode',
              label: 'Mode',
              options: [
                { value: 'full', label: 'Cross' },
                { value: 'dot', label: 'Dot' },
                { value: 'arrow', label: 'Arrow' },
              ],
            },
            { kind: 'color', key: 'theme.crosshair', label: 'Color', inline: true },
            {
              kind: 'lineStyle',
              key: 'opt.crosshairLineStyle',
              label: 'Line style',
              visibleWhen: { key: 'opt.crosshairMode', equals: 'full' },
            },
          ],
        },
        {
          id: 'watermark',
          label: 'Watermark',
          fields: [
            { kind: 'boolean', key: 'opt.watermarkVisible', label: 'Show watermark' },
            { kind: 'color', key: 'theme.watermark', label: 'Color', inline: true },
            {
              kind: 'text',
              key: 'opt.watermarkText',
              label: 'Text',
              placeholder: 'Symbol, interval',
              visibleWhen: { key: 'opt.watermarkVisible', truthy: true },
            },
          ],
        },
      ],
    },
    {
      id: 'canvas',
      label: 'Canvas',
      groups: [
        {
          id: 'volume',
          label: 'Volume',
          fields: [
            { kind: 'boolean', key: 'opt.volumeVisible', label: 'Show volume pane' },
            { kind: 'color', key: 'theme.volumeUp', label: 'Up', inline: true },
            { kind: 'color', key: 'theme.volumeDown', label: 'Down', inline: true },
            {
              kind: 'number',
              key: 'opt.volumePaneRatio',
              label: 'Pane height',
              min: 0.08,
              max: 0.5,
              step: 0.01,
              visibleWhen: { key: 'opt.volumeVisible', truthy: true },
            },
          ],
        },
        {
          id: 'margins',
          label: 'Margins',
          fields: [
            {
              kind: 'number',
              key: 'opt.marginTop',
              label: 'Top',
              min: 0,
              max: 40,
              step: 1,
              unit: '%',
            },
            {
              kind: 'number',
              key: 'opt.marginBottom',
              label: 'Bottom',
              min: 0,
              max: 40,
              step: 1,
              unit: '%',
            },
            {
              kind: 'number',
              key: 'opt.rightMargin',
              label: 'Right',
              min: 0,
              max: 200,
              step: 1,
              unit: 'bars',
            },
          ],
        },
        {
          id: 'rendering',
          label: 'Rendering',
          fields: [{ kind: 'boolean', key: 'opt.hiDpi', label: 'High-DPI (retina) rendering' }],
        },
      ],
    },
  ],
};
