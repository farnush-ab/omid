import {
  distanceToSegment,
  extendSegment,
  formatDuration,
  formatPercent,
  formatSigned,
  type Point,
  type Rect,
} from '@/lib/core';
import {
  BaseDrawing,
  barsBetween,
  drawInfoBox,
  drawLineEnd,
  strokeSegment,
  textFont,
  type DrawingContext,
  type DrawingRenderState,
} from '../../framework';
import type { TrendLineStyle } from './style';

const TEXT_GAP = 6;

/** Two-anchor line with extensions, line ends, stats box and a text label along the line. */
export class TrendLine extends BaseDrawing<TrendLineStyle> {
  protected segment(dc: DrawingContext): [Point, Point] {
    const [a, b] = this.pixels(dc);
    const pa = a ?? { x: 0, y: 0 };
    const pb = b ?? pa;
    return extendSegment(pa, pb, dc.pane, this.style.extendLeft, this.style.extendRight);
  }

  protected renderShape(
    ctx: CanvasRenderingContext2D,
    dc: DrawingContext,
    state: DrawingRenderState,
  ): void {
    const s = this.style;
    const [a, b] = this.pixels(dc);
    if (!a || !b) return;
    const [ea, eb] = this.segment(dc);
    const stroke = { color: s.color, width: s.lineWidth, style: s.lineStyle, opacity: s.opacity };
    strokeSegment(ctx, ea, eb, stroke);
    drawLineEnd(ctx, s.startEnd, b, a, stroke);
    drawLineEnd(ctx, s.endEnd, a, b, stroke);
    if (s.showMiddlePoint) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 3 + s.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.text.trim()) this.renderText(ctx, a, b);
    if (s.alwaysShowStats || state.selected || state.hovered) this.renderStats(ctx, dc, a, b);
  }

  private renderText(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    const s = this.style;
    let angle = Math.atan2(b.y - a.y, b.x - a.x);
    const flip = angle > Math.PI / 2 || angle < -Math.PI / 2;
    const [p0, p1] = flip ? [b, a] : [a, b];
    if (flip) angle += Math.PI;
    const t = s.textAlign === 'left' ? 0 : s.textAlign === 'right' ? 1 : 0.5;
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = textFont(s);
    ctx.fillStyle = s.textColor;
    ctx.textAlign = s.textAlign === 'left' ? 'left' : s.textAlign === 'right' ? 'right' : 'center';
    ctx.textBaseline =
      s.textPosition === 'top' ? 'bottom' : s.textPosition === 'bottom' ? 'top' : 'middle';
    const dy = s.textPosition === 'top' ? -TEXT_GAP : s.textPosition === 'bottom' ? TEXT_GAP : 0;
    const lines = s.text.split('\n');
    const lh = s.fontSize * 1.25;
    const offset = s.textPosition === 'top' ? -(lines.length - 1) * lh : 0;
    lines.forEach((l, i) => ctx.fillText(l, 0, dy + offset + i * lh));
    ctx.restore();
  }

  /** Lines for the info box (price range, %, ticks, bars, time, distance, angle). */
  statsLines(dc: DrawingContext, a: Point, b: Point): string[] {
    const s = this.style;
    const [p0, p1] = this.points;
    if (!p0 || !p1) return [];
    const lines: string[] = [];
    const dp = p1.price - p0.price;
    const range: string[] = [];
    if (s.showPriceRange) range.push(formatSigned(dp, dc.symbol.pricePrecision));
    if (s.showPercentChange) range.push(`(${formatPercent((dp / p0.price) * 100)})`);
    if (s.showPriceRange) range.push(`${Math.round(dp / dc.symbol.tickSize)} ticks`);
    if (range.length) lines.push(range.join(' '));
    const span: string[] = [];
    if (s.showBarsRange) span.push(`${Math.round(barsBetween(p0.time, p1.time, dc))} bars`);
    if (s.showDateRange) span.push(formatDuration(p1.time - p0.time));
    if (span.length) lines.push(span.join(', '));
    const extra: string[] = [];
    if (s.showDistance) extra.push(`${Math.round(Math.hypot(b.x - a.x, b.y - a.y))} px`);
    if (s.showAngle)
      extra.push(`∠ ${Math.round((Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI)}°`);
    if (extra.length) lines.push(extra.join('   '));
    return lines;
  }

  private renderStats(ctx: CanvasRenderingContext2D, dc: DrawingContext, a: Point, b: Point): void {
    const lines = this.statsLines(dc, a, b);
    if (lines.length === 0) return;
    const pos = this.style.statsPosition;
    const at =
      pos === 'left' ? a : pos === 'right' ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const other = pos === 'left' ? b : a;
    const align = pos === 'center' ? 'center' : at.x >= other.x ? 'right' : 'left';
    drawInfoBox(ctx, lines, at, {
      bg: dc.theme.colors.crosshairLabelBg,
      fg: dc.theme.colors.crosshairLabelText,
      align,
      below: at.y >= other.y,
    });
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tolerance: number): boolean {
    const [a, b] = this.segment(dc);
    return distanceToSegment({ x, y }, a, b) <= tolerance + this.style.lineWidth / 2;
  }

  override bounds(dc: DrawingContext): Rect | null {
    if (this.style.extendLeft || this.style.extendRight) return null;
    return super.bounds(dc);
  }
}
