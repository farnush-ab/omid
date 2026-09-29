import { formatPercent, formatSigned, rectContains, withOpacity, type Rect } from '@/lib/core';
import {
  BaseDrawing,
  barsBetween,
  drawInfoBox,
  fillTextLines,
  layoutText,
  setStroke,
  type AnchorHandle,
  type ChartPoint,
  type DrawingContext,
  type DrawingRenderState,
  type Modifiers,
} from '../../framework';
import type { RectangleStyle } from './style';

const TEXT_PAD = 8;

/**
 * Two stored corners (A, B). Eight handles: 0=A, 1=B, 2=(tA,pB), 3=(tB,pA),
 * 4/5 = left/right sides (time of A/B), 6/7 = sides at price of A/B.
 */
export class Rectangle extends BaseDrawing<RectangleStyle> {
  private box(dc: DrawingContext, extended: boolean): Rect {
    const [a, b] = this.pixels(dc);
    const pa = a ?? { x: 0, y: 0 };
    const pb = b ?? pa;
    let x1 = Math.min(pa.x, pb.x);
    let x2 = Math.max(pa.x, pb.x);
    if (extended && this.style.extendLeft) x1 = Math.min(x1, dc.pane.x);
    if (extended && this.style.extendRight) x2 = Math.max(x2, dc.pane.x + dc.pane.width);
    const y1 = Math.min(pa.y, pb.y);
    return { x: x1, y: y1, width: x2 - x1, height: Math.abs(pb.y - pa.y) };
  }

  override getAnchors(dc: DrawingContext): AnchorHandle[] {
    const [a, b] = this.pixels(dc);
    if (!a || !b) return [];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const diag = (x: number, y: number, ox: number, oy: number) =>
      (x - ox) * (y - oy) > 0 ? 'nwse-resize' : 'nesw-resize';
    return [
      { index: 0, x: a.x, y: a.y, cursor: diag(a.x, a.y, b.x, b.y) },
      { index: 1, x: b.x, y: b.y, cursor: diag(b.x, b.y, a.x, a.y) },
      { index: 2, x: a.x, y: b.y, cursor: diag(a.x, b.y, b.x, a.y) },
      { index: 3, x: b.x, y: a.y, cursor: diag(b.x, a.y, a.x, b.y) },
      { index: 4, x: a.x, y: my, cursor: 'ew-resize' },
      { index: 5, x: b.x, y: my, cursor: 'ew-resize' },
      { index: 6, x: mx, y: a.y, cursor: 'ns-resize' },
      { index: 7, x: mx, y: b.y, cursor: 'ns-resize' },
    ];
  }

  override moveAnchor(index: number, p: ChartPoint, _dc: DrawingContext, _mods: Modifiers): void {
    const [a, b] = this.points;
    if (!a || !b) return;
    const set = (A: ChartPoint, B: ChartPoint) => (this.points = [A, B]);
    switch (index) {
      case 0:
        return void set(p, b);
      case 1:
        return void set(a, p);
      case 2:
        return void set({ time: p.time, price: a.price }, { time: b.time, price: p.price });
      case 3:
        return void set({ time: a.time, price: p.price }, { time: p.time, price: b.price });
      case 4:
        return void set({ time: p.time, price: a.price }, b);
      case 5:
        return void set(a, { time: p.time, price: b.price });
      case 6:
        return void set({ time: a.time, price: p.price }, b);
      case 7:
        return void set(a, { time: b.time, price: p.price });
    }
  }

  protected renderShape(
    ctx: CanvasRenderingContext2D,
    dc: DrawingContext,
    state: DrawingRenderState,
  ): void {
    const s = this.style;
    const r = this.box(dc, true);
    if (s.fillEnabled) {
      ctx.fillStyle = withOpacity(s.fillColor, s.fillOpacity);
      ctx.fillRect(r.x, r.y, r.width, r.height);
    }
    if (s.showMiddleLine) {
      setStroke(ctx, {
        color: s.middleLineColor,
        width: s.middleLineWidth,
        style: s.middleLineStyle,
        opacity: s.middleLineOpacity,
      });
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.height / 2);
      ctx.lineTo(r.x + r.width, r.y + r.height / 2);
      ctx.stroke();
    }
    setStroke(ctx, {
      color: s.borderColor,
      width: s.borderWidth,
      style: s.borderStyle,
      opacity: s.borderOpacity,
    });
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    if (s.text.trim()) this.renderText(ctx, r);
    if ((s.showPriceRange || s.showBarsRange) && this.points.length === 2)
      this.renderStats(ctx, dc, r);
    void state;
  }

  private renderText(ctx: CanvasRenderingContext2D, r: Rect): void {
    const s = this.style;
    const maxWidth = s.textWrap ? Math.max(10, r.width - TEXT_PAD * 2) : null;
    const t = {
      text: s.text,
      color: s.textColor,
      fontSize: s.fontSize,
      bold: s.bold,
      italic: s.italic,
    };
    const lay = layoutText(ctx, t, { align: s.textHAlign, maxWidth });
    const y =
      s.textVAlign === 'top'
        ? r.y + TEXT_PAD
        : s.textVAlign === 'bottom'
          ? r.y + r.height - TEXT_PAD - lay.height
          : r.y + (r.height - lay.height) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
    if (s.textWrap) ctx.clip();
    fillTextLines(
      ctx,
      lay.lines,
      { x: r.x + TEXT_PAD, y, width: r.width - TEXT_PAD * 2, height: lay.height },
      lay.lineHeight,
      s.textHAlign,
      t,
    );
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, dc: DrawingContext, r: Rect): void {
    const [a, b] = this.points as [ChartPoint, ChartPoint];
    const parts: string[] = [];
    if (this.style.showPriceRange) {
      const lo = Math.min(a.price, b.price);
      const d = Math.abs(b.price - a.price);
      parts.push(`${formatSigned(d, dc.symbol.pricePrecision)} (${formatPercent((d / lo) * 100)})`);
    }
    if (this.style.showBarsRange)
      parts.push(`${Math.round(Math.abs(barsBetween(a.time, b.time, dc)))} bars`);
    drawInfoBox(
      ctx,
      [parts.join(' · ')],
      { x: r.x + r.width / 2, y: r.y + r.height },
      {
        bg: dc.theme.colors.crosshairLabelBg,
        fg: dc.theme.colors.crosshairLabelText,
        align: 'center',
        below: true,
      },
    );
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const r = this.box(dc, true);
    const outer = {
      x: r.x - tol,
      y: r.y - tol,
      width: r.width + tol * 2,
      height: r.height + tol * 2,
    };
    if (!rectContains(outer, x, y)) return false;
    if (this.style.fillEnabled) return true;
    const inner = {
      x: r.x + tol,
      y: r.y + tol,
      width: r.width - tol * 2,
      height: r.height - tol * 2,
    };
    return inner.width <= 0 || inner.height <= 0 || !rectContains(inner, x, y);
  }

  override bounds(dc: DrawingContext): Rect | null {
    if (this.style.extendLeft || this.style.extendRight) return null;
    return super.bounds(dc);
  }
}
