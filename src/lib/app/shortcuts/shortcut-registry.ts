import { Registry } from '@/lib/core';
import { chordOf, normalizeChord, type KeyInput } from './keys';

export type ShortcutCategory = 'General' | 'Chart' | 'Drawing tools' | 'Drawings' | 'Replay';

export interface ShortcutDefinition<C = unknown> {
  readonly id: string;
  readonly keys: readonly string[];
  readonly description: string;
  readonly category: ShortcutCategory;
  /** Only active when this returns true. */
  readonly when?: (ctx: C) => boolean;
  readonly allowRepeat?: boolean;
  /** Works but is not listed in the shortcuts dialog (e.g. variants documented elsewhere). */
  readonly hidden?: boolean;
  run(ctx: C): void;
}

/** Central registry: the keyboard handler and the shortcuts dialog both read from here. */
export class ShortcutRegistry<C> extends Registry<ShortcutDefinition<C>> {
  constructor() {
    super('ShortcutRegistry');
  }

  /** Finds the first enabled shortcut for this key event (registration order = priority). */
  match(e: KeyInput, ctx: C): ShortcutDefinition<C> | null {
    const chord = chordOf(e);
    for (const s of this.list()) {
      if (e.repeat && !s.allowRepeat) continue;
      if (!s.keys.some((k) => normalizeChord(k) === chord)) continue;
      if (s.when && !s.when(ctx)) continue;
      return s;
    }
    return null;
  }

  byCategory(): Map<ShortcutCategory, ShortcutDefinition<C>[]> {
    const map = new Map<ShortcutCategory, ShortcutDefinition<C>[]>();
    for (const s of this.list()) {
      if (s.hidden) continue;
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }
}
