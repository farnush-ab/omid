import { z } from 'zod';
import {
  distanceToPolyline,
  polygonContains,
  sampleQuadratic,
  withOpacity,
  type Point,
} from '@/lib/core';
import {
  BaseDrawing,
  LINE_END_OPTIONS,
  drawLineEnd,
  fromPixel,
  lineFields,
  setStroke,
  toPixel,
  zColor,
  zLineEnd,
  zLineStyle,
  zLineWidth,
  zOpacity,
  type AnchorHandle,
  type DrawingContext,
  type DrawingToolDefinition,
} from '../../framework';

const curveStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  startEnd: zLineEnd,
  endEnd: zLineEnd,
  fillEnabled: z.boolean(),
  fillColor: zColor,
  fillOpacity: zOpacity,
});
type CurveStyle = z.infer<typeof curveStyleSchema>;

/** Initial bulge of the curve relative to its chord length. */
const DEFAULT_BULGE = 0.25;
const SAMPLES = 48;

/** Quadratic control point such that the curve passes through `mid` at t = 0.5. */
const controlFor = (a: Point, mid: Point, b: Point): Point => ({
  x: 2 * mid.x - (a.x + b.x) / 2,
  y: 2 * mid.y - (a.y + b.y) / 2,
});

/**
 * TradingView-style curve: start, end and a handle that lies ON the curve (its midpoint).
 * points = [start, end, handle].
 */
class Curve extends BaseDrawing<CurveStyle> {
  private samples(dc: DrawingContext): Point[] {
    const [a, b, h] = this.pixels(dc);
    if (!a || !b) return [];
    const mid = h ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return sampleQuadratic(a, controlFor(a, mid, b), b, SAMPLES);
  }

  override getAnchors(dc: DrawingContext): AnchorHandle[] {
    return super.getAnchors(dc).map((a) => (a.index === 2 ? { ...a, cursor: 'grab' } : a));
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const s = this.style;
    const pts = this.samples(dc);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (s.fillEnabled) {
      ctx.closePath();
      ctx.fillStyle = withOpacity(s.fillColor, s.fillOpacity);
      ctx.fill();
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    }
    const stroke = { color: s.color, width: s.lineWidth, style: s.lineStyle, opacity: s.opacity };
    setStroke(ctx, stroke);
    ctx.stroke();
    drawLineEnd(ctx, s.startEnd, pts[1]!, pts[0]!, stroke);
    drawLineEnd(ctx, s.endEnd, pts[pts.length - 2]!, pts[pts.length - 1]!, stroke);
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const pts = this.samples(dc);
    const p = { x, y };
    if (distanceToPolyline(p, pts) <= tol + this.style.lineWidth / 2) return true;
    return this.style.fillEnabled && pts.length > 2 && polygonContains(pts, p);
  }
}

export const curveTool: DrawingToolDefinition<CurveStyle> = {
  id: 'curve',
  label: 'Curve',
  icon: 'M3 18C7 4 17 4 21 18M3 18h.01M21 18h.01M12 7.5h.01',
  shortcut: 'Alt+Shift+C',
  placement: { kind: 'points', count: 2 },
  defaults: {
    color: '#2962ff',
    opacity: 1,
    lineWidth: 2,
    lineStyle: 'solid',
    startEnd: 'none',
    endEnd: 'none',
    fillEnabled: false,
    fillColor: '#2962ff',
    fillOpacity: 0.15,
  },
  styleSchema: curveStyleSchema,
  themeDefaults: { color: 'drawingLine' },
  angleConstraint: true,
  toolbar: ['color', 'lineWidth', 'lineStyle'],
  pointLabels: ['Start', 'End', 'Curve handle'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'line',
            fields: [
              ...lineFields({
                color: 'color',
                opacity: 'opacity',
                width: 'lineWidth',
                style: 'lineStyle',
              }),
              { kind: 'select', key: 'startEnd', label: 'Line start', options: LINE_END_OPTIONS },
              { kind: 'select', key: 'endEnd', label: 'Line end', options: LINE_END_OPTIONS },
              { kind: 'boolean', key: 'fillEnabled', label: 'Background' },
              {
                kind: 'color',
                key: 'fillColor',
                label: 'Fill',
                opacityKey: 'fillOpacity',
                inline: true,
              },
            ],
          },
        ],
      },
    ],
  },
  /** Adds the on-curve handle, bulging perpendicular to the chord. */
  finalizePoints(points, dc) {
    const [a, b] = points;
    if (!a || !b) return [...points];
    if (points.length >= 3) return [...points];
    const pa = toPixel(a, dc);
    const pb = toPixel(b, dc);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const mid = {
      x: (pa.x + pb.x) / 2 - dy * DEFAULT_BULGE,
      y: (pa.y + pb.y) / 2 + dx * DEFAULT_BULGE,
    };
    return [a, b, fromPixel(mid.x, mid.y, dc, false)];
  },
  create: (init) => new Curve('curve', init),
};
