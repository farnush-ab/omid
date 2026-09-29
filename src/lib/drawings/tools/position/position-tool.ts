import { rectContains, roundToStep, type Rect } from '@/lib/core';
import {
  BaseDrawing,
  type AnchorHandle,
  type ChartPoint,
  type DrawingContext,
  type DrawingRenderState,
  type Modifiers,
} from '../../framework';
import {
  evaluatePosition,
  positionStats,
  type PositionLevels,
  type PositionOutcome,
  type PositionStats,
  type Side,
} from './position-math';
import { renderPosition } from './position-render';
import type { PositionStyle } from './style';

/**
 * Shared Long/Short risk-reward tool. points = [entry@start, target@end, stop@end].
 * Handles: 0 entry (moves the whole tool in time + entry price), 1 target, 2 stop, 3 right edge.
 * Subclasses only fix the side; all direction-dependent maths flips on `side`.
 */
export abstract class PositionTool extends BaseDrawing<PositionStyle> {
  abstract readonly side: Side;

  get levels(): PositionLevels {
    const [e, t, s] = this.points;
    return { side: this.side, entry: e?.price ?? 0, target: t?.price ?? 0, stop: s?.price ?? 0 };
  }

  get startTime(): number {
    return this.points[0]?.time ?? 0;
  }

  get endTime(): number {
    return this.points[1]?.time ?? this.startTime;
  }

  stats(dc: DrawingContext): PositionStats {
    const s = this.style;
    return positionStats(this.levels, {
      accountSize: s.accountSize,
      riskMode: s.riskMode,
      risk: s.risk,
      lotSize: s.lotSize,
      leverage: s.leverage,
      tickSize: dc.symbol.tickSize,
      qtyStep: dc.symbol.qtyStep,
    });
  }

  /** Live status against the bars the chart can see (replay-safe). */
  outcome(dc: DrawingContext): PositionOutcome {
    return evaluatePosition(dc.data, this.levels, this.startTime, this.endTime);
  }

  private geometry(dc: DrawingContext) {
    const l = this.levels;
    const c = dc.coords;
    return {
      x1: c.timeToX(this.startTime),
      x2: c.timeToX(this.endTime),
      yEntry: c.priceToY(l.entry),
      yTarget: c.priceToY(l.target),
      yStop: c.priceToY(l.stop),
    };
  }

  private box(dc: DrawingContext): Rect {
    const g = this.geometry(dc);
    const top = Math.min(g.yTarget, g.yStop);
    return {
      x: Math.min(g.x1, g.x2),
      y: top,
      width: Math.abs(g.x2 - g.x1),
      height: Math.max(g.yTarget, g.yStop) - top,
    };
  }

  override getAnchors(dc: DrawingContext): AnchorHandle[] {
    const g = this.geometry(dc);
    return [
      { index: 0, x: g.x1, y: g.yEntry, cursor: 'move' },
      { index: 1, x: g.x1, y: g.yTarget, cursor: 'ns-resize' },
      { index: 2, x: g.x1, y: g.yStop, cursor: 'ns-resize' },
      { index: 3, x: g.x2, y: g.yEntry, cursor: 'ew-resize' },
    ];
  }

  override moveAnchor(index: number, p: ChartPoint, dc: DrawingContext, _mods: Modifiers): void {
    const tick = dc.symbol.tickSize;
    const c = dc.coords;
    const { entry, target, stop } = this.levels;
    const startIdx = c.timeToIndex(this.startTime);
    const endIdx = c.timeToIndex(this.endTime);
    let start = this.startTime;
    let end = this.endTime;
    let e = entry;
    let t = target;
    let s = stop;
    const price = roundToStep(p.price, tick);
    const up = this.side === 'long' ? 1 : -1;
    if (index === 0) {
      const width = endIdx - startIdx;
      start = p.time;
      end = c.indexToTime(c.timeToIndex(p.time) + width);
      // The entry must stay strictly between stop and target; otherwise keep the old entry.
      e = up * (target - price) >= tick && up * (price - stop) >= tick ? price : entry;
    } else if (index === 1) {
      t = up * (price - e) >= tick ? price : e + up * tick;
    } else if (index === 2) {
      s = up * (e - price) >= tick ? price : e - up * tick;
    } else if (index === 3) {
      end = c.indexToTime(Math.max(startIdx + 1, c.timeToIndex(p.time)));
    }
    this.points = [
      { time: start, price: roundToStep(e, tick) },
      { time: end, price: roundToStep(t, tick) },
      { time: end, price: roundToStep(s, tick) },
    ];
  }

  protected renderShape(
    ctx: CanvasRenderingContext2D,
    dc: DrawingContext,
    state: DrawingRenderState,
  ): void {
    if (this.points.length < 3) return;
    renderPosition(ctx, dc, {
      side: this.side,
      style: this.style,
      geometry: this.geometry(dc),
      stats: this.stats(dc),
      outcome: this.outcome(dc),
      levels: this.levels,
      showStats: this.style.alwaysShowStats || state.selected || state.hovered,
    });
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const b = this.box(dc);
    return rectContains(
      { x: b.x - tol, y: b.y - tol, width: b.width + tol * 2, height: b.height + tol * 2 },
      x,
      y,
    );
  }

  override priceRange(): { min: number; max: number } | null {
    const { entry, target, stop } = this.levels;
    return { min: Math.min(entry, target, stop), max: Math.max(entry, target, stop) };
  }
}

export class LongPosition extends PositionTool {
  readonly side = 'long' as const;
}

export class ShortPosition extends PositionTool {
  readonly side = 'short' as const;
}
