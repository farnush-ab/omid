/**
 * TEMPLATE — copy this folder to `tools/<your-tool>/`, rename, then add ONE line to
 * `src/lib/drawings/register.ts`:
 *
 *     .register(myTool)
 *
 * That is all: the toolbar button, tooltip + shortcut, placement workflow, settings dialog
 * (Style + Coordinates tabs), floating toolbar, persistence validation, undo/redo, copy/paste
 * and the shared contract tests all derive from this definition.
 *
 * This example is a "Horizontal Ray": one click, a line from the anchor to the right edge.
 * It is intentionally NOT registered.
 */
import { z } from 'zod';
import { distanceToSegment } from '@/lib/core';
import {
  BaseDrawing,
  lineFields,
  strokeSegment,
  zColor,
  zLineStyle,
  zLineWidth,
  zOpacity,
  type DrawingContext,
  type DrawingToolDefinition,
} from '../../framework';

// 1. Style: a zod schema is the single source of truth for the style type and its validation.
const styleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  showPrice: z.boolean(),
});
type ExampleStyle = z.infer<typeof styleSchema>;

// 2. The drawing: extend BaseDrawing and implement rendering + body hit-testing.
//    Anchors, anchor hit-testing, serialisation and bounds come for free (override if needed).
class HorizontalRay extends BaseDrawing<ExampleStyle> {
  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const [a] = this.pixels(dc);
    if (!a) return;
    const s = this.style;
    const end = { x: dc.pane.x + dc.pane.width, y: a.y };
    strokeSegment(ctx, a, end, {
      color: s.color,
      width: s.lineWidth,
      style: s.lineStyle,
      opacity: s.opacity,
    });
    if (s.showPrice) {
      ctx.fillStyle = s.color;
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(dc.formatPrice(this.points[0]!.price), a.x + 4, a.y - 3);
    }
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tolerance: number): boolean {
    const [a] = this.pixels(dc);
    if (!a) return false;
    return distanceToSegment({ x, y }, a, { x: dc.pane.x + dc.pane.width, y: a.y }) <= tolerance;
  }

  // Extends to the right edge, so never cull it.
  override bounds(): null {
    return null;
  }
}

// 3. The definition: metadata, placement, defaults, settings schema, factory.
export const exampleTool: DrawingToolDefinition<ExampleStyle> = {
  id: 'horizontal-ray', // unique, stable (persisted in saved drawings)
  label: 'Horizontal Ray',
  icon: 'M4 12h16M4 12h.01', // 24×24 SVG path data
  shortcut: 'Alt+Shift+Y', // optional; must be unique
  placement: { kind: 'single' }, // 'points' | 'polyline' | 'freehand' | 'single'
  defaults: { color: '#2962ff', opacity: 1, lineWidth: 1, lineStyle: 'solid', showPrice: true },
  styleSchema,
  themeDefaults: { color: 'drawingLine' }, // optional: default colour follows the theme
  toolbar: ['color', 'lineWidth', 'lineStyle'], // floating-toolbar controls (style keys)
  pointLabels: ['Anchor'],
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
              { kind: 'boolean', key: 'showPrice', label: 'Show price' },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new HorizontalRay('horizontal-ray', init),
};
