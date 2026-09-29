import { describe, expect, it } from 'vitest';
import { DEFAULT_CHART_OPTIONS, THEME_COLOR_KEYS, validateSchema } from '@/lib/core';
import {
  THEME_COLOR_GROUPS,
  darkTheme,
  lightTheme,
  parseTheme,
  serializeTheme,
} from '@/lib/themes';
import { CHART_SETTINGS_SCHEMA } from '@/lib/app/settings/chart-settings-schema';
import { parseChartOptions } from '@/lib/app/settings/chart-options-schema';
import { chordOf, normalizeChord } from '@/lib/app/shortcuts/keys';
import { IntervalTyper } from '@/lib/app/shortcuts/interval-typer';

describe('themes', () => {
  it('editor groups cover every theme colour exactly once', () => {
    const keys = THEME_COLOR_GROUPS.flatMap((g) => g.colors.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...THEME_COLOR_KEYS].sort());
  });

  it('built-ins define every colour', () => {
    for (const t of [darkTheme, lightTheme])
      expect(Object.keys(t.colors).sort()).toEqual([...THEME_COLOR_KEYS].sort());
  });

  it('parses exported themes and fills missing colours', () => {
    const exported = serializeTheme({ ...darkTheme, id: 'x', name: 'Mine', builtIn: false });
    expect(parseTheme(exported)).toMatchObject({ id: 'x', name: 'Mine', builtIn: false });
    const partial = parseTheme({ id: 'p', name: 'Partial', colors: { background: '#000000' } });
    expect(partial?.colors.upBody).toBe(darkTheme.colors.upBody);
    expect(
      parseTheme({ id: 'p', name: 'Bad', colors: { background: 'javascript:alert(1)' } }),
    ).toBeNull();
  });
});

describe('chart settings', () => {
  it('the settings schema is structurally valid', () => {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(DEFAULT_CHART_OPTIONS)) values[`opt.${k}`] = v;
    for (const [k, v] of Object.entries(darkTheme.colors)) values[`theme.${k}`] = v;
    expect(validateSchema(CHART_SETTINGS_SCHEMA, values)).toEqual([]);
  });

  it('parses persisted options forward-compatibly', () => {
    expect(parseChartOptions({ showBody: false, futureKey: 1 })).toEqual({
      ...DEFAULT_CHART_OPTIONS,
      showBody: false,
    });
    expect(parseChartOptions({ scaleMode: 'weird' })).toBeNull();
  });
});

describe('keyboard', () => {
  const key = (k: Partial<Parameters<typeof chordOf>[0]>) =>
    chordOf({ key: '', code: '', ctrl: false, meta: false, alt: false, shift: false, ...k });

  it('builds canonical chords', () => {
    expect(key({ key: 'z', code: 'KeyZ', ctrl: true })).toBe('Ctrl+Z');
    expect(key({ key: 'Z', code: 'KeyZ', meta: true, shift: true })).toBe('Ctrl+Shift+Z');
    expect(key({ key: '†', code: 'KeyT', alt: true })).toBe('Alt+T');
    expect(key({ key: '?', code: 'Slash', shift: true })).toBe('?');
    expect(key({ key: 'ArrowRight', code: 'ArrowRight', shift: true })).toBe('Shift+ArrowRight');
    expect(key({ key: ' ', code: 'Space' })).toBe('Space');
    expect(normalizeChord('ctrl+shift+z')).toBe('Ctrl+Shift+Z');
  });

  it('interval typer accumulates and parses', () => {
    const t = new IntervalTyper();
    expect(t.input('h')).toBe(false);
    expect(t.input('4')).toBe(true);
    t.input('h');
    expect(t.text).toBe('4h');
    expect(t.commit()).toBe('4h');
    expect(t.active).toBe(false);
    t.input('7');
    expect(t.parsed).toBeNull();
    t.input('Backspace');
    expect(t.active).toBe(false);
  });
});
