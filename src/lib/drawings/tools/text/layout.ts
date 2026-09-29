import type { Point, Rect } from '@/lib/core';
import { textFont, wrapWith } from '../../framework';
import type { TextStyle } from './style';

export interface TextLayout {
  readonly lines: string[];
  readonly lineHeight: number;
  /** Unrotated box, top-left at the anchor. */
  readonly box: Rect;
  readonly font: string;
}

const LINE_HEIGHT = 1.3;
const MIN_AUTO_WIDTH = 12;

export function layoutTextBox(
  s: TextStyle,
  anchor: Point,
  measure: (text: string, font: string) => number,
): TextLayout {
  const font = textFont({
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    bold: s.bold,
    italic: s.italic,
  });
  const m = (t: string) => measure(t, font);
  const inner = s.wrap && s.boxWidth > 0 ? Math.max(10, s.boxWidth - s.padding * 2) : null;
  const lines = wrapWith(m, s.text || ' ', inner);
  const lineHeight = Math.round(s.fontSize * LINE_HEIGHT);
  const contentW = inner ?? Math.max(MIN_AUTO_WIDTH, ...lines.map(m));
  return {
    lines,
    lineHeight,
    font,
    box: {
      x: anchor.x,
      y: anchor.y,
      width: contentW + s.padding * 2,
      height: lines.length * lineHeight + s.padding * 2,
    },
  };
}

/** Rotates p around origin by `deg` degrees. */
export function rotate(p: Point, origin: Point, deg: number): Point {
  if (!deg) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}
