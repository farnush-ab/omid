import type {
  ChartEngine,
  EventBus,
  IdGenerator,
  Theme,
  ThemeColorKey,
  ThemeColors,
} from '@/lib/core';
import { readEnvelope, wrap, type VersionedStore } from '@/lib/storage';
import { DEFAULT_THEME_ID, parseTheme, serializeTheme, themeRegistry } from '@/lib/themes';
import type { AppEventMap } from '../app-events';
import { APP_CONFIG } from '../config';

interface StoredThemes {
  themes: Theme[];
  activeId: string;
}

function validateStored(data: unknown): StoredThemes | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { themes?: unknown; activeId?: unknown };
  const themes = Array.isArray(d.themes)
    ? d.themes.map((t) => parseTheme(t)).filter((t): t is Theme => t !== null)
    : [];
  return { themes, activeId: typeof d.activeId === 'string' ? d.activeId : DEFAULT_THEME_ID };
}

export type ImportResult = { ok: true; theme: Theme } | { ok: false; error: string };

/**
 * Built-in themes come from the ThemeRegistry; user themes are CRUD-managed here and
 * persisted with the active theme. `preview()` applies a draft without saving (live preview).
 */
export class ThemeService {
  private custom: Theme[] = [];
  private activeId: string = DEFAULT_THEME_ID;
  private previewTheme: Theme | null = null;

  constructor(
    private readonly engine: ChartEngine,
    private readonly store: VersionedStore,
    private readonly events: EventBus<AppEventMap>,
    private readonly newId: IdGenerator,
  ) {}

  async load(): Promise<void> {
    const stored = await this.store.load(APP_CONFIG.storageKeys.themes, 'themes', validateStored);
    if (stored) {
      this.custom = stored.themes;
      this.activeId = this.find(stored.activeId) ? stored.activeId : DEFAULT_THEME_ID;
    }
    this.apply();
  }

  list(): Theme[] {
    return [...themeRegistry.list(), ...this.custom];
  }

  get active(): Theme {
    return this.find(this.activeId) ?? themeRegistry.require(DEFAULT_THEME_ID);
  }

  find(id: string): Theme | undefined {
    return themeRegistry.get(id) ?? this.custom.find((t) => t.id === id);
  }

  setActive(id: string): void {
    if (!this.find(id)) return;
    this.activeId = id;
    this.previewTheme = null;
    this.changed();
  }

  /** Live preview of an unsaved draft (null restores the active theme). */
  preview(theme: Theme | null): void {
    this.previewTheme = theme;
    this.apply();
  }

  /** Creates a user theme from `baseId` and returns it. */
  duplicate(baseId: string, name?: string): Theme {
    const base = this.find(baseId) ?? this.active;
    const theme: Theme = {
      id: `theme-${this.newId()}`,
      name: this.uniqueName(name ?? `${base.name} copy`),
      builtIn: false,
      dark: base.dark,
      colors: { ...base.colors },
    };
    this.custom = [...this.custom, theme];
    this.changed();
    return theme;
  }

  /** Saves a full colour set to a user theme (built-ins are immutable). */
  save(id: string, colors: ThemeColors, name?: string): void {
    this.custom = this.custom.map((t) =>
      t.id === id
        ? { ...t, colors: { ...colors }, ...(name ? { name: this.uniqueName(name, id) } : {}) }
        : t,
    );
    this.previewTheme = null;
    this.changed();
  }

  rename(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.custom = this.custom.map((t) =>
      t.id === id ? { ...t, name: this.uniqueName(trimmed, id) } : t,
    );
    this.changed();
  }

  remove(id: string): void {
    this.custom = this.custom.filter((t) => t.id !== id);
    if (this.activeId === id) this.activeId = DEFAULT_THEME_ID;
    this.changed();
  }

  /**
   * Changes one colour of the active theme (chart settings dialog). A built-in theme is first
   * copied into a user theme so built-ins stay pristine.
   */
  setActiveColor(key: ThemeColorKey, value: string): void {
    let theme = this.active;
    if (theme.builtIn) {
      theme = this.duplicate(theme.id, `${theme.name} (custom)`);
      this.activeId = theme.id;
    }
    this.save(theme.id, { ...theme.colors, [key]: value });
  }

  exportTheme(id: string): string {
    const theme = this.find(id) ?? this.active;
    return JSON.stringify(
      wrap('themes', { themes: [serializeTheme(theme)], activeId: theme.id }),
      null,
      2,
    );
  }

  /** Imports every theme contained in an exported file; returns the first. */
  importTheme(raw: unknown): ImportResult {
    const res = readEnvelope(raw, 'themes', validateStored);
    let incoming: Theme[] = res.ok ? res.value.themes : [];
    if (!res.ok) {
      const single = parseTheme(raw);
      if (!single) return { ok: false, error: res.error };
      incoming = [single];
    }
    if (incoming.length === 0) return { ok: false, error: 'The file contains no themes' };
    const added = incoming.map((t) => ({
      ...t,
      id: `theme-${this.newId()}`,
      name: this.uniqueName(t.name),
    }));
    this.custom = [...this.custom, ...added];
    this.activeId = added[0]!.id;
    this.changed();
    return { ok: true, theme: added[0]! };
  }

  private uniqueName(name: string, exceptId?: string): string {
    const taken = new Set(
      this.list()
        .filter((t) => t.id !== exceptId)
        .map((t) => t.name),
    );
    if (!taken.has(name)) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
  }

  private apply(): void {
    this.engine.setTheme(this.previewTheme ?? this.active);
    this.events.emit('themes:changed', {
      themes: this.list(),
      active: this.previewTheme ?? this.active,
      previewing: this.previewTheme !== null,
    });
  }

  private changed(): void {
    this.apply();
    void this.store.save(APP_CONFIG.storageKeys.themes, 'themes', {
      themes: this.custom.map(serializeTheme),
      activeId: this.activeId,
    });
  }
}
