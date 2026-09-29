import { ENGINE_CONFIG, boundsOf, distance, type Point, type Rect } from '@/lib/core';
import { toPixel } from './geometry';
import type {
  AnchorHandle,
  ChartPoint,
  Drawing,
  DrawingContext,
  DrawingInit,
  DrawingRenderState,
  DrawingStyle,
  HitResult,
  Modifiers,
  SerializedDrawing,
} from './types';

const HIT = ENGINE_CONFIG.hitTolerancePx;
const HANDLE_HIT = ENGINE_CONFIG.handles.hitRadius;
const BOUNDS_PAD = 24;

/**
 * Shared behaviour for drawings: storage, serialisation, anchor handles, anchor hit-testing,
 * bounds. Tools implement `renderShape` and `hitBody` (and override anchors when needed).
 */
export abstract class BaseDrawing<S extends DrawingStyle> implements Drawing<S> {
  readonly id: string;
  points: ChartPoint[];
  style: S;
  locked: boolean;
  hidden: boolean;

  constructor(
    readonly type: string,
    init: DrawingInit<S>,
  ) {
    this.id = init.id;
    this.points = init.points.map((p) => ({ time: p.time, price: p.price }));
    this.style = { ...init.style };
    this.locked = init.locked ?? false;
    this.hidden = init.hidden ?? false;
  }

  protected abstract renderShape(
    ctx: CanvasRenderingContext2D,
    dc: DrawingContext,
    state: DrawingRenderState,
  ): void;

  /** True when (x, y) is on the drawing's body, within `tolerance` px. */
  protected abstract hitBody(x: number, y: number, dc: DrawingContext, tolerance: number): boolean;

  render(ctx: CanvasRenderingContext2D, dc: DrawingContext, state: DrawingRenderState): void {
    this.renderShape(ctx, dc, state);
  }

  protected px(p: ChartPoint, dc: DrawingContext): Point {
    return toPixel(p, dc);
  }

  protected pixels(dc: DrawingContext): Point[] {
    return this.points.map((p) => toPixel(p, dc));
  }

  getAnchors(dc: DrawingContext): AnchorHandle[] {
    return this.pixels(dc).map((p, index) => ({ index, x: p.x, y: p.y, cursor: 'move' }));
  }

  hitTest(x: number, y: number, dc: DrawingContext): HitResult | null {
    const at = { x, y };
    let best: AnchorHandle | null = null;
    let bestD: number = HANDLE_HIT;
    for (const a of this.getAnchors(dc)) {
      const d = distance(at, a);
      if (d <= bestD) {
        best = a;
        bestD = d;
      }
    }
    if (best) return { part: 'anchor', anchor: best.index, cursor: best.cursor };
    return this.hitBody(x, y, dc, HIT) ? { part: 'body', cursor: 'pointer' } : null;
  }

  moveAnchor(index: number, point: ChartPoint, _dc: DrawingContext, _mods: Modifiers): void {
    if (index >= 0 && index < this.points.length) this.points[index] = point;
  }

  bounds(dc: DrawingContext): Rect | null {
    if (this.points.length === 0) return null;
    const b = boundsOf(this.pixels(dc));
    return {
      x: b.x - BOUNDS_PAD,
      y: b.y - BOUNDS_PAD,
      width: b.width + BOUNDS_PAD * 2,
      height: b.height + BOUNDS_PAD * 2,
    };
  }

  priceRange(): { min: number; max: number } | null {
    if (this.points.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const p of this.points) {
      min = Math.min(min, p.price);
      max = Math.max(max, p.price);
    }
    return { min, max };
  }

  serialize(): SerializedDrawing<S> {
    return {
      id: this.id,
      type: this.type,
      points: this.points.map((p) => ({ time: p.time, price: p.price })),
      style: structuredClone(this.style),
      locked: this.locked,
      hidden: this.hidden,
    };
  }
}
