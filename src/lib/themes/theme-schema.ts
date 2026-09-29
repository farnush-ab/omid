import { z } from 'zod';
import { THEME_COLOR_KEYS, parseColor, type Theme, type ThemeColors } from '@/lib/core';
import { darkTheme } from './builtin/dark';

const CSS_COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\))$/i;

export const colorSchema = z.string().trim().regex(CSS_COLOR, 'Invalid colour');

const colorsShape = Object.fromEntries(
  THEME_COLOR_KEYS.map((k) => [k, colorSchema.optional()]),
) as Record<keyof ThemeColors, z.ZodOptional<typeof colorSchema>>;

export const themeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(64),
  dark: z.boolean().optional(),
  colors: z.object(colorsShape),
});

/**
 * Validates untrusted theme JSON. Missing colours are filled from the built-in theme of the same
 * brightness so older/partial files still load. Returned themes are never built-in.
 */
export function parseTheme(input: unknown, fallback: Theme = darkTheme): Theme | null {
  const r = themeSchema.safeParse(input);
  if (!r.success) return null;
  const colors = { ...fallback.colors } as ThemeColors;
  for (const k of THEME_COLOR_KEYS) {
    const v = r.data.colors[k];
    if (v) colors[k] = v;
  }
  const dark = r.data.dark ?? parseColor(colors.background).r < 128;
  return { id: r.data.id, name: r.data.name, builtIn: false, dark, colors };
}

export function serializeTheme(theme: Theme): Omit<Theme, 'builtIn'> {
  return { id: theme.id, name: theme.name, dark: theme.dark, colors: { ...theme.colors } };
}
