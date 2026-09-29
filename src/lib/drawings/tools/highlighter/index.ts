import { z } from 'zod';
import { distanceToPolyline, withOpacity, type Rect } from '@/lib/core';
import {
  BaseDrawing,
  chaikin,
  zColor,
  zOpacity,
  type AnchorHandle,
  type DrawingContext,
  type DrawingToolDefinition,
} from '../../framework';

const highlighterStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  width: z.number().min(2).max(60),
  smoothing: z.number().min(0).max(1),
});
type HighlighterStyle = z.infer<typeof highlighterStyleSchema>;

const MAX_SMOOTHING_PASSES = 3;

/** Freehand marker stroke; samples are stored as (time, price) so it sticks to the chart. */
class Highlighter extends BaseDrawing<HighlighterStyle> {
  private stroke(dc: DrawingContext) {
    return chaikin(this.pixels(dc), Math.round(this.style.smoothing * MAX_SMOOTHING_PASSES));
  }

  /** Only the stroke ends are handles (hundreds of sample points would be noise). */
  override getAnchors(dc: DrawingContext): AnchorHandle[] {
    const pts = this.pixels(dc);
    if (pts.length === 0) return [];
    const last = pts.length - 1;
    return [
      { index: 0, x: pts[0]!.x, y: pts[0]!.y, cursor: 'move' },
      ...(last > 0 ? [{ index: last, x: pts[last]!.x, y: pts[last]!.y, cursor: 'move' }] : []),
    ];
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const pts = this.stroke(dc);
    if (pts.length === 0) return;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.style.width;
    ctx.strokeStyle = withOpacity(this.style.color, this.style.opacity);
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    if (pts.length === 1) ctx.lineTo(pts[0]!.x + 0.1, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    ctx.stroke();
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const pts = this.pixels(dc);
    return (
      distanceToPolyline({ x, y }, pts.length === 1 ? [pts[0]!, pts[0]!] : pts) <=
      this.style.width / 2 + tol / 2
    );
  }

  override bounds(dc: DrawingContext): Rect | null {
    const b = super.bounds(dc);
    if (!b) return null;
    const w = this.style.width;
    return { x: b.x - w, y: b.y - w, width: b.width + w * 2, height: b.height + w * 2 };
  }
}

export const highlighterTool: DrawingToolDefinition<HighlighterStyle> = {
  id: 'highlighter',
  label: 'Highlighter',
  icon: 'M15 4l5 5-9 9H6v-5zM4 21h9',
  shortcut: 'Alt+Shift+H',
  placement: { kind: 'freehand' },
  defaults: { color: '#ffeb3b', opacity: 0.35, width: 16, smoothing: 0.6 },
  styleSchema: highlighterStyleSchema,
  snapToBars: false,
  toolbar: ['color', 'width'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'brush',
            fields: [
              { kind: 'color', key: 'color', label: 'Color', opacityKey: 'opacity' },
              {
                kind: 'number',
                key: 'width',
                label: 'Brush width',
                min: 2,
                max: 60,
                step: 1,
                unit: 'px',
              },
              { kind: 'number', key: 'smoothing', label: 'Smoothing', min: 0, max: 1, step: 0.1 },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new Highlighter('highlighter', init),
};
