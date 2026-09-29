export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const cache = new Map<string, Rgba>();

/** Parses #rgb, #rrggbb, #rrggbbaa and rgb()/rgba() strings. Unknown input -> opaque black. */
export function parseColor(input: string): Rgba {
  const hit = cache.get(input);
  if (hit) return hit;
  let out: Rgba = { r: 0, g: 0, b: 0, a: 1 };
  const s = input.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    if (!Number.isNaN(n)) {
      out = {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255,
        a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m?.[1]) {
      const parts = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      out = { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
    }
  }
  if (cache.size > 512) cache.clear();
  cache.set(input, out);
  return out;
}

export function toRgbaString(c: Rgba): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${+c.a.toFixed(3)})`;
}

/** Applies an extra opacity multiplier (0..1) to any CSS colour. */
export function withOpacity(color: string, opacity: number): string {
  const c = parseColor(color);
  return toRgbaString({ ...c, a: c.a * opacity });
}

/** #rrggbb (drops alpha) — for <input type="color">. */
export function toHex6(color: string): string {
  const { r, g, b } = parseColor(color);
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function toHex8(color: string): string {
  const c = parseColor(color);
  return `${toHex6(color)}${Math.round(c.a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

export function alphaOf(color: string): number {
  return parseColor(color).a;
}

/** Perceived luminance 0..1 — used to pick readable label text. */
export function luminance(color: string): number {
  const { r, g, b } = parseColor(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function contrastText(background: string): string {
  return luminance(background) > 0.6 ? '#131722' : '#ffffff';
}
