import { polygonContains, withOpacity, type Rect } from '@/lib/core';
import {
  BaseDrawing,
  H_ALIGN_OPTIONS,
  fillTextLines,
  toPixel,
  type AnchorHandle,
  type ChartPoint,
  type DrawingContext,
  type DrawingToolDefinition,
  type Modifiers,
} from '../../framework';
import { layoutTextBox, rotate } from './layout';
import { TEXT_DEFAULTS, textStyleSchema, type TextStyle } from './style';

const MIN_BOX = 40;

/**
 * Free text anchored at a (time, price) point (the box's top-left). Handles: 0 = anchor,
 * 1 = right edge (resizes the box width and enables wrapping). Supports rotation.
 */
class TextDrawing extends BaseDrawing<TextStyle> {
  readonly textKey = 'text';

  private layout(dc: DrawingContext) {
    const anchor = toPixel(this.points[0]!, dc);
    return { anchor, ...layoutTextBox(this.style, anchor, dc.measureText) };
  }

  private corners(dc: DrawingContext) {
    const { anchor, box } = this.layout(dc);
    const r = this.style.rotation;
    return [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      { x: box.x, y: box.y + box.height },
    ].map((p) => rotate(p, anchor, r));
  }

  textRect(dc: DrawingContext): Rect {
    return this.layout(dc).box;
  }

  override getAnchors(dc: DrawingContext): AnchorHandle[] {
    const { anchor, box } = this.layout(dc);
    const edge = rotate(
      { x: box.x + box.width, y: box.y + box.height / 2 },
      anchor,
      this.style.rotation,
    );
    return [
      { index: 0, x: anchor.x, y: anchor.y, cursor: 'move' },
      { index: 1, x: edge.x, y: edge.y, cursor: 'ew-resize' },
    ];
  }

  override moveAnchor(index: number, p: ChartPoint, dc: DrawingContext, _mods: Modifiers): void {
    if (index === 0) {
      this.points = [p];
      return;
    }
    const anchor = toPixel(this.points[0]!, dc);
    const local = rotate(toPixel(p, dc), anchor, -this.style.rotation);
    this.style = {
      ...this.style,
      wrap: true,
      boxWidth: Math.round(Math.max(MIN_BOX, local.x - anchor.x)),
    };
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const s = this.style;
    const { anchor, box, lines, lineHeight } = this.layout(dc);
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.translate(-anchor.x, -anchor.y);
    if (s.bgEnabled) {
      ctx.fillStyle = withOpacity(s.bgColor, s.bgOpacity);
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }
    if (s.borderEnabled) {
      ctx.setLineDash([]);
      ctx.strokeStyle = s.borderColor;
      ctx.lineWidth = s.borderWidth;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
    if (!s.text) return;
    const inner = {
      x: box.x + s.padding,
      y: box.y + s.padding,
      width: box.width - s.padding * 2,
      height: box.height - s.padding * 2,
    };
    fillTextLines(ctx, lines, inner, lineHeight, s.align, { ...s, text: s.text });
  }

  protected hitBody(x: number, y: number, dc: DrawingContext): boolean {
    return polygonContains(this.corners(dc), { x, y });
  }

  override bounds(dc: DrawingContext): Rect {
    const c = this.corners(dc);
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    return {
      x: Math.min(...xs) - 8,
      y: Math.min(...ys) - 8,
      width: Math.max(...xs) - Math.min(...xs) + 16,
      height: Math.max(...ys) - Math.min(...ys) + 16,
    };
  }
}

export const textTool: DrawingToolDefinition<TextStyle> = {
  id: 'text',
  label: 'Text',
  icon: 'M5 5h14M12 5v14M9 19h6',
  shortcut: 'Alt+Shift+T',
  placement: { kind: 'single' },
  defaults: TEXT_DEFAULTS,
  styleSchema: textStyleSchema,
  themeDefaults: { color: 'drawingText' },
  editTextOnCreate: true,
  snapToBars: false,
  toolbar: ['color', 'bgColor', 'borderColor'],
  pointLabels: ['Anchor'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'text',
            fields: [
              { kind: 'color', key: 'color', label: 'Text' },
              { kind: 'fontSize', key: 'fontSize', label: 'Size', inline: true },
              { kind: 'fontFamily', key: 'fontFamily', label: 'Font' },
              { kind: 'boolean', key: 'bold', label: 'Bold' },
              { kind: 'boolean', key: 'italic', label: 'Italic' },
              { kind: 'select', key: 'align', label: 'Alignment', options: H_ALIGN_OPTIONS },
              { kind: 'text', key: 'text', label: 'Text', multiline: true },
            ],
          },
          {
            id: 'box',
            label: 'Box',
            fields: [
              { kind: 'boolean', key: 'bgEnabled', label: 'Background' },
              {
                kind: 'color',
                key: 'bgColor',
                label: 'Background',
                opacityKey: 'bgOpacity',
                inline: true,
              },
              { kind: 'boolean', key: 'borderEnabled', label: 'Border' },
              { kind: 'color', key: 'borderColor', label: 'Border', inline: true },
              {
                kind: 'lineWidth',
                key: 'borderWidth',
                label: 'Border width',
                visibleWhen: { key: 'borderEnabled', truthy: true },
              },
              { kind: 'boolean', key: 'wrap', label: 'Text wrap' },
              {
                kind: 'number',
                key: 'boxWidth',
                label: 'Box width',
                min: 0,
                max: 4000,
                step: 10,
                unit: 'px',
                visibleWhen: { key: 'wrap', truthy: true },
              },
              { kind: 'number', key: 'padding', label: 'Padding', min: 0, max: 64, unit: 'px' },
              {
                kind: 'number',
                key: 'rotation',
                label: 'Rotation',
                min: -180,
                max: 180,
                step: 5,
                unit: '°',
              },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new TextDrawing('text', init),
};
