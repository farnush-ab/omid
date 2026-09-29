/** Central UI design tokens (sizes, layering, motion). Colours come from the active theme (CSS vars). */
export const UI = {
  topBarHeight: 40,
  sideBarWidth: 48,
  iconSize: 18,
  radius: 6,
  z: { chartOverlay: 10, floating: 20, menu: 40, dialog: 50, toast: 60, tooltip: 70 },
  motion: { fast: 120, normal: 180 },
  tooltipDelayMs: 350,
} as const;

/** Maps theme colours to CSS custom properties consumed by Tailwind utilities (see globals.css). */
export const THEME_CSS_VARS = {
  '--tc-bg': 'background',
  '--tc-panel': 'uiPanel',
  '--tc-border': 'uiPanelBorder',
  '--tc-text': 'uiText',
  '--tc-muted': 'uiTextMuted',
  '--tc-hover': 'uiHover',
  '--tc-accent': 'uiAccent',
  '--tc-accent-text': 'uiAccentText',
  '--tc-up': 'upBody',
  '--tc-down': 'downBody',
} as const;
