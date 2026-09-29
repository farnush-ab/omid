import { Registry, type Theme } from '@/lib/core';

/** Built-in themes. User themes are managed by the app's ThemeService on top of this. */
export const themeRegistry = new Registry<Theme>('ThemeRegistry');
