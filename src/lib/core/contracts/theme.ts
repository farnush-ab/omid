/** Every colour the chart and the UI chrome use. Values are CSS colours (#rrggbb, #rrggbbaa, rgba()). */
export interface ThemeColors {
  background: string;
  backgroundGradientEnd: string;
  grid: string;
  text: string;
  scaleBorder: string;
  crosshair: string;
  crosshairLabelBg: string;
  crosshairLabelText: string;
  upBody: string;
  downBody: string;
  upBorder: string;
  downBorder: string;
  upWick: string;
  downWick: string;
  volumeUp: string;
  volumeDown: string;
  prevCloseLine: string;
  watermark: string;
  drawingLine: string;
  drawingText: string;
  drawingHandle: string;
  selection: string;
  uiPanel: string;
  uiPanelBorder: string;
  uiText: string;
  uiTextMuted: string;
  uiHover: string;
  uiAccent: string;
  uiAccentText: string;
}

export type ThemeColorKey = keyof ThemeColors;

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly builtIn: boolean;
  readonly dark: boolean;
  readonly colors: ThemeColors;
}

export const THEME_COLOR_KEYS: readonly ThemeColorKey[] = [
  'background',
  'backgroundGradientEnd',
  'grid',
  'text',
  'scaleBorder',
  'crosshair',
  'crosshairLabelBg',
  'crosshairLabelText',
  'upBody',
  'downBody',
  'upBorder',
  'downBorder',
  'upWick',
  'downWick',
  'volumeUp',
  'volumeDown',
  'prevCloseLine',
  'watermark',
  'drawingLine',
  'drawingText',
  'drawingHandle',
  'selection',
  'uiPanel',
  'uiPanelBorder',
  'uiText',
  'uiTextMuted',
  'uiHover',
  'uiAccent',
  'uiAccentText',
];
