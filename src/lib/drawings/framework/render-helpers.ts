import {
  applyLineStyle,
  arrowHead,
  roundRect,
  withOpacity,
  wrapText,
  type LineStyle,
  type Point,
  type Rect,
} from '@/lib/core';

export type LineEnd = 'none' | 'arrow' | 'circle';

export interface StrokeStyle {
  readonly color: string;
  readonly width: number;
  readonly style: LineStyle;
  readonly opacity?: number;
}

export function setStroke(ctx: CanvasRenderingContext2D, s: StrokeStyle): void {
  applyLineStyle(
    ctx,
    s.opacity === undefined ? s.color : withOpacity(s.color, s.opacity),
    s.width,
    s.style,
  );
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export function strokeSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  s: StrokeStyle,
): void {
  setStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Draws an arrow head or circle at `at`, oriented from `from`. */
export function drawLineEnd(
  ctx: CanvasRenderingContext2D,
  kind: LineEnd,
  from: Point,
  at: Point,
  s: StrokeStyle,
): void {
  if (kind === 'none') return;
  ctx.setLineDash([]);
  const size = 6 + s.width * 2;
  if (kind === 'arrow') {
    setStroke(ctx, { ...s, style: 'solid' });
    arrowHead(ctx, from, at, size);
  } else {
    ctx.fillStyle = s.opacity === undefined ? s.color : withOpacity(s.color, s.opacity);
    ctx.beginPath();
    ctx.arc(at.x, at.y, 2 + s.width * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface TextStyle {
  readonly text: string;
  readonly color: string;
  readonly fontSize: number;
  readonly fontFamily?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

export function textFont(
  t: Pick<TextStyle, 'fontSize' | 'fontFamily' | 'bold' | 'italic'>,
): string {
  return `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.fontSize}px ${t.fontFamily ?? 'Inter, system-ui, sans-serif'}`;
}

export interface TextBlockOptions {
  readonly align: 'left' | 'center' | 'right';
  readonly maxWidth: number | null;
  readonly lineHeight?: number;
}

/** Lays out wrapped text; returns lines and the block size. */
export function layoutText(
  ctx: CanvasRenderingContext2D,
  t: TextStyle,
  opts: TextBlockOptions,
): { lines: string[]; width: number; height: number; lineHeight: number } {
  ctx.font = textFont(t);
  const lines = wrapText(ctx, t.text, opts.maxWidth);
  const lineHeight = opts.lineHeight ?? Math.round(t.fontSize * 1.3);
  let width = 0;
  for (const l of lines) width = Math.max(width, ctx.measureText(l).width);
  if (opts.maxWidth !== null) width = Math.max(width, opts.maxWidth);
  return { lines, width, height: lines.length * lineHeight, lineHeight };
}

/** Draws pre-laid-out lines inside `box` with the given horizontal alignment. */
export function fillTextLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  box: Rect,
  lineHeight: number,
  align: 'left' | 'center' | 'right',
  t: TextStyle,
): void {
  ctx.font = textFont(t);
  ctx.fillStyle = t.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const x =
    align === 'left' ? box.x : align === 'right' ? box.x + box.width : box.x + box.width / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, box.y + lineHeight * (i + 0.5)));
}

/** Compact info box (trend-line / rectangle stats). Returns its rect. */
export function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  anchor: Point,
  opts: {
    readonly bg: string;
    readonly fg: string;
    readonly align: 'left' | 'center' | 'right';
    readonly below?: boolean;
  },
): Rect {
  const font = '12px Inter, system-ui, sans-serif';
  ctx.font = font;
  const padX = 8;
  const lh = 17;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  const h = lines.length * lh + 8;
  const x =
    opts.align === 'left'
      ? anchor.x - w - 10
      : opts.align === 'right'
        ? anchor.x + 10
        : anchor.x - w / 2;
  const y = opts.below ? anchor.y + 12 : anchor.y - h - 12;
  ctx.setLineDash([]);
  ctx.fillStyle = opts.bg;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x + padX, y + 4 + lh * (i + 0.5)));
  return { x, y, width: w, height: h };
}
