'use client';

import { useEffect } from 'react';
import { THEME_CSS_VARS } from '../ui/tokens';
import { useUiStore } from '../state/ui-store';

/** Pushes the active theme's UI colours into CSS custom properties (design tokens). */
export function useThemeCssVars(): void {
  const theme = useUiStore((s) => s.activeTheme);
  useEffect(() => {
    const root = document.documentElement;
    for (const [cssVar, key] of Object.entries(THEME_CSS_VARS)) {
      root.style.setProperty(cssVar, theme.colors[key]);
    }
    root.style.colorScheme = theme.dark ? 'dark' : 'light';
  }, [theme]);
}
