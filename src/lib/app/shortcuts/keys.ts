/** Framework-free view of a keyboard event. */
export interface KeyInput {
  readonly key: string;
  readonly code: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly repeat?: boolean;
}

const NAMED: Readonly<Record<string, string>> = {
  ' ': 'Space',
  Esc: 'Escape',
  Del: 'Delete',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
};

/**
 * Canonical chord string, e.g. "Ctrl+Shift+Z", "Alt+T", "Shift+ArrowRight", "?".
 * Letters/digits come from `code` (layout- and Alt-independent); other printable keys use
 * `key` and drop Shift (it is implied by the character). Cmd counts as Ctrl.
 */
export function chordOf(e: KeyInput): string {
  let main: string;
  let printable = false;
  if (/^Key[A-Z]$/.test(e.code)) main = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) main = e.code.slice(5);
  else {
    main = NAMED[e.key] ?? e.key;
    printable = main.length === 1;
  }
  const mods: string[] = [];
  if (e.ctrl || e.meta) mods.push('Ctrl');
  if (e.alt) mods.push('Alt');
  if (e.shift && !printable) mods.push('Shift');
  return [...mods, main.length === 1 ? main.toUpperCase() : main].join('+');
}

/** Normalises a human-written chord ("ctrl+shift+z") to the canonical form. */
export function normalizeChord(chord: string): string {
  const parts = chord.split('+').map((p) => p.trim());
  const main = parts.pop() ?? '';
  const mods = new Set(parts.map((m) => m.toLowerCase()));
  const out: string[] = [];
  if (mods.has('ctrl') || mods.has('cmd') || mods.has('meta')) out.push('Ctrl');
  if (mods.has('alt') || mods.has('option')) out.push('Alt');
  if (mods.has('shift')) out.push('Shift');
  const m = NAMED[main] ?? main;
  out.push(m.length === 1 ? m.toUpperCase() : m);
  return out.join('+');
}

/** Pretty label for UI (tooltips, shortcuts dialog). */
export function chordLabel(chord: string): string {
  return chord
    .replace('ArrowRight', '→')
    .replace('ArrowLeft', '←')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace(/\+/g, ' + ');
}
