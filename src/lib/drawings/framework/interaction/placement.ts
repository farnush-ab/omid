import { distance } from '@/lib/core';
import { toPixel } from '../geometry';
import type {
  AnyToolDefinition,
  ChartPoint,
  Drawing,
  DrawingContext,
  DrawingStyle,
} from '../types';

/** Minimum pixel distance between freehand samples. */
const FREEHAND_STEP_PX = 2.5;
/** A press-drag longer than this places a two-point tool in one gesture. */
export const DRAG_PLACE_PX = 6;

export type PlacementStep = 'continue' | 'done';

/**
 * One in-progress placement (TradingView click workflow) with a live preview drawing.
 * `points` are committed clicks; `cursor` follows the pointer.
 */
export class PlacementSession {
  readonly drawing: Drawing;
  private readonly clicks: ChartPoint[] = [];
  private cursor: ChartPoint;

  constructor(
    readonly def: AnyToolDefinition,
    id: string,
    style: DrawingStyle,
    first: ChartPoint,
    private readonly dc: () => DrawingContext,
  ) {
    this.clicks.push(first);
    this.cursor = first;
    this.drawing = def.create({ id, points: [first], style });
    this.sync();
  }

  get committed(): readonly ChartPoint[] {
    return this.clicks;
  }

  /** The last committed click (angle-constraint reference). */
  get lastClick(): ChartPoint {
    return this.clicks[this.clicks.length - 1]!;
  }

  /** Placement is complete as soon as it is created (single-click tools). */
  get immediate(): boolean {
    return this.def.placement.kind === 'single';
  }

  move(p: ChartPoint): void {
    if (this.def.placement.kind === 'freehand') {
      const dc = this.dc();
      if (distance(toPixel(this.lastClick, dc), toPixel(p, dc)) >= FREEHAND_STEP_PX)
        this.clicks.push(p);
    }
    this.cursor = p;
    this.sync();
  }

  /** Registers a click; returns 'done' when the tool has all its points. */
  click(p: ChartPoint): PlacementStep {
    const spec = this.def.placement;
    this.cursor = p;
    if (spec.kind === 'points') {
      this.clicks.push(p);
      this.sync();
      return this.clicks.length >= spec.count ? 'done' : 'continue';
    }
    if (spec.kind === 'polyline') {
      const dc = this.dc();
      const last = this.lastClick;
      if (distance(toPixel(last, dc), toPixel(p, dc)) > 2) this.clicks.push(p);
      this.sync();
      return 'continue';
    }
    return 'done';
  }

  /** Two-point tools placed with press-drag-release. */
  dragRelease(p: ChartPoint): PlacementStep {
    if (this.def.placement.kind === 'points' && this.clicks.length === 1) return this.click(p);
    return 'continue';
  }

  canFinish(): boolean {
    const spec = this.def.placement;
    if (spec.kind === 'polyline') return this.clicks.length >= spec.min;
    if (spec.kind === 'freehand') return this.clicks.length >= 2;
    if (spec.kind === 'points') return this.clicks.length >= spec.count;
    return true;
  }

  /** Final drawing with finalized points (the preview object itself). */
  finish(): Drawing {
    this.drawing.points = this.finalPoints([...this.clicks]);
    return this.drawing;
  }

  private sync(): void {
    const spec = this.def.placement;
    let pts: ChartPoint[];
    if (spec.kind === 'freehand' || spec.kind === 'single') pts = [...this.clicks];
    else if (spec.kind === 'points') pts = [...this.clicks, this.cursor].slice(0, spec.count);
    else pts = [...this.clicks, this.cursor];
    this.drawing.points = this.finalPoints(pts);
  }

  private finalPoints(pts: ChartPoint[]): ChartPoint[] {
    return this.def.finalizePoints ? this.def.finalizePoints(pts, this.dc()) : pts;
  }
}
