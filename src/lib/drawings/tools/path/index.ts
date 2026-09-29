import { z } from 'zod';
import { distanceToPolyline, distanceToSegment, polygonContains, withOpacity } from '@/lib/core';
import {
  BaseDrawing,
  drawLineEnd,
  fromPixel,
  lineFields,
  setStroke,
  zColor,
  zLineStyle,
  zLineWidth,
  zOpacity,
  type DrawingContext,
  type DrawingToolDefinition,
} from '../../framework';

const pathStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  startEnd: z.enum(['none', 'arrow']),
  endEnd: z.enum(['none', 'arrow']),
  closed: z.boolean(),
  fillEnabled: z.boolean(),
  fillColor: zColor,
  fillOpacity: zOpacity,
});
type PathStyle = z.infer<typeof pathStyleSchema>;

const MIN_POINTS = 2;

/** Multi-point polyline. Double-click a segment to insert a point, a point to delete it. */
class Path extends BaseDrawing<PathStyle> {
  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const s = this.style;
    const pts = this.pixels(dc);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (s.closed) {
      ctx.closePath();
      if (s.fillEnabled) {
        ctx.fillStyle = withOpacity(s.fillColor, s.fillOpacity);
        ctx.fill();
      }
    }
    const stroke = { color: s.color, width: s.lineWidth, style: s.lineStyle, opacity: s.opacity };
    setStroke(ctx, stroke);
    ctx.stroke();
    if (!s.closed) {
      drawLineEnd(ctx, s.startEnd, pts[1]!, pts[0]!, stroke);
      drawLineEnd(ctx, s.endEnd, pts[pts.length - 2]!, pts[pts.length - 1]!, stroke);
    }
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const pts = this.pixels(dc);
    const p = { x, y };
    const ring = this.style.closed && pts.length > 2 ? [...pts, pts[0]!] : pts;
    if (distanceToPolyline(p, ring) <= tol + this.style.lineWidth / 2) return true;
    return this.style.closed && this.style.fillEnabled && pts.length > 2 && polygonContains(pts, p);
  }

  insertPointAt(x: number, y: number, dc: DrawingContext): boolean {
    const pts = this.pixels(dc);
    let best = -1;
    let bestD = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const d = distanceToSegment({ x, y }, pts[i - 1]!, pts[i]!);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return false;
    this.points.splice(best, 0, fromPixel(x, y, dc, false));
    return true;
  }

  removePoint(index: number): boolean {
    if (this.points.length <= MIN_POINTS || index < 0 || index >= this.points.length) return false;
    this.points.splice(index, 1);
    return true;
  }
}

export const pathTool: DrawingToolDefinition<PathStyle> = {
  id: 'path',
  label: 'Path',
  icon: 'M3 18l5-8 5 5 8-10M3 18h.01M8 10h.01M13 15h.01M21 5h.01',
  shortcut: 'Alt+Shift+P',
  placement: { kind: 'polyline', min: MIN_POINTS },
  defaults: {
    color: '#2962ff',
    opacity: 1,
    lineWidth: 2,
    lineStyle: 'solid',
    startEnd: 'none',
    endEnd: 'arrow',
    closed: false,
    fillEnabled: false,
    fillColor: '#2962ff',
    fillOpacity: 0.15,
  },
  styleSchema: pathStyleSchema,
  themeDefaults: { color: 'drawingLine' },
  angleConstraint: true,
  toolbar: ['color', 'lineWidth', 'lineStyle'],
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
              {
                kind: 'select',
                key: 'startEnd',
                label: 'Line start',
                options: [
                  { value: 'none', label: 'Normal' },
                  { value: 'arrow', label: 'Arrow' },
                ],
                visibleWhen: { key: 'closed', equals: false },
              },
              {
                kind: 'select',
                key: 'endEnd',
                label: 'Line end',
                options: [
                  { value: 'none', label: 'Normal' },
                  { value: 'arrow', label: 'Arrow' },
                ],
                visibleWhen: { key: 'closed', equals: false },
              },
              { kind: 'boolean', key: 'closed', label: 'Close path' },
              {
                kind: 'boolean',
                key: 'fillEnabled',
                label: 'Fill',
                visibleWhen: { key: 'closed', truthy: true },
              },
              {
                kind: 'color',
                key: 'fillColor',
                label: 'Fill',
                opacityKey: 'fillOpacity',
                inline: true,
                visibleWhen: { key: 'closed', truthy: true },
              },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new Path('path', init),
};
