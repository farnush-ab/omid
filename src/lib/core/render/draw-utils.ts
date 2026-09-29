import type { LineStyle } from '../contracts/settings-schema';
import { ENGINE_CONFIG } from '../config';

/** Snaps a coordinate so a line of `width` css px renders crisply at `dpr`. */
export function crisp(v: number, dpr: number, width = 1): number {
  const deviceWidth = Math.max(1, Math.round(width * dpr));
  const offset = deviceWidth % 2 === 1 ? 0.5 : 0;
  return (Math.round(v * dpr) + offset) / dpr;
}

export function dashFor(style: LineStyle, width: number): number[] {
  switch (style) {
    case 'dashed':
      return [5 * Math.max(1, width), 4 * Math.max(1, width)];
    case 'dotted':
      return [Math.max(1, width), 2.5 * Math.max(1, width)];
    default:
      return [];
  }
}

export function applyLineStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  style: LineStyle = 'solid',
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashFor(style, width));
}

export function fontString(
  size: number,
  family: string = ENGINE_CONFIG.font.family,
  bold = false,
  italic = false,
): string {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${family}`;
}

export function hLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x0: number,
  x1: number,
  dpr: number,
  width = 1,
): void {
  const yy = crisp(y, dpr, width);
  ctx.beginPath();
  ctx.moveTo(x0, yy);
  ctx.lineTo(x1, yy);
  ctx.stroke();
}

export function vLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number,
  dpr: number,
  width = 1,
): void {
  const xx = crisp(x, dpr, width);
  ctx.beginPath();
  ctx.moveTo(xx, y0);
  ctx.lineTo(xx, y1);
  ctx.stroke();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws a filled label. (x, y) is the anchor; `align` picks which edge x refers to and
 * the label is vertically centred on y.
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    bg: string;
    fg: string;
    font: string;
    align?: 'left' | 'center' | 'right';
    radius?: number;
    padX?: number;
    height?: number;
  },
): LabelBox {
  ctx.font = opts.font;
  const padX = opts.padX ?? ENGINE_CONFIG.labelPadding.x;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = opts.height ?? Math.round(parseFloat(opts.font.replace(/^\D*/, '')) * 1.8);
  const align = opts.align ?? 'left';
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  const top = Math.round(y - h / 2);
  ctx.fillStyle = opts.bg;
  roundRect(ctx, left, top, w, h, opts.radius ?? 2);
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + padX, top + h / 2 + 0.5);
  return { x: left, y: top, width: w, height: h };
}

/** Arrow head at `to` pointing away from `from`. */
export function arrowHead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
): void {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x - size * Math.cos(ang - Math.PI / 7), to.y - size * Math.sin(ang - Math.PI / 7));
  ctx.lineTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(ang + Math.PI / 7), to.y - size * Math.sin(ang + Math.PI / 7));
  ctx.stroke();
}

/** Word-wraps text to `maxWidth` with the ctx's current font. Explicit newlines are kept. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number | null,
): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (maxWidth === null || maxWidth <= 0) {
      out.push(para);
      continue;
    }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const candidate = line + word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}
