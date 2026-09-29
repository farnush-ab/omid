import type { ThemeColorKey } from '@/lib/core';

/** How the theme editor groups and labels colours. Pure data, rendered generically by the UI. */
export const THEME_COLOR_GROUPS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly colors: ReadonlyArray<{ readonly key: ThemeColorKey; readonly label: string }>;
}> = [
  {
    id: 'chart',
    label: 'Chart',
    colors: [
      { key: 'background', label: 'Background' },
      { key: 'backgroundGradientEnd', label: 'Gradient end' },
      { key: 'grid', label: 'Grid' },
      { key: 'watermark', label: 'Watermark' },
    ],
  },
  {
    id: 'candles',
    label: 'Candles & volume',
    colors: [
      { key: 'upBody', label: 'Up body' },
      { key: 'downBody', label: 'Down body' },
      { key: 'upBorder', label: 'Up border' },
      { key: 'downBorder', label: 'Down border' },
      { key: 'upWick', label: 'Up wick' },
      { key: 'downWick', label: 'Down wick' },
      { key: 'volumeUp', label: 'Volume up' },
      { key: 'volumeDown', label: 'Volume down' },
    ],
  },
  {
    id: 'scales',
    label: 'Scales & crosshair',
    colors: [
      { key: 'text', label: 'Scale text' },
      { key: 'scaleBorder', label: 'Scale lines' },
      { key: 'crosshair', label: 'Crosshair' },
      { key: 'crosshairLabelBg', label: 'Crosshair label' },
      { key: 'crosshairLabelText', label: 'Crosshair label text' },
      { key: 'prevCloseLine', label: 'Prev. close line' },
    ],
  },
  {
    id: 'drawings',
    label: 'Drawing defaults',
    colors: [
      { key: 'drawingLine', label: 'Line' },
      { key: 'drawingText', label: 'Text' },
      { key: 'drawingHandle', label: 'Handle fill' },
      { key: 'selection', label: 'Selection' },
    ],
  },
  {
    id: 'ui',
    label: 'Interface',
    colors: [
      { key: 'uiPanel', label: 'Panels' },
      { key: 'uiPanelBorder', label: 'Borders' },
      { key: 'uiText', label: 'Text' },
      { key: 'uiTextMuted', label: 'Muted text' },
      { key: 'uiHover', label: 'Hover' },
      { key: 'uiAccent', label: 'Accent' },
      { key: 'uiAccentText', label: 'Accent text' },
    ],
  },
];
