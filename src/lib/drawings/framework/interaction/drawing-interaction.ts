import {
  constrainAngle,
  distance,
  type ChartPointerEvent,
  type InteractionHandler,
} from '@/lib/core';
import { fromPixel, shiftPoint, toPixel } from '../geometry';
import { snapPrice, type MagnetMode } from '../magnet';
import type { DrawingManager } from '../drawing-manager';
import type {
  AnyToolDefinition,
  ChartPoint,
  Drawing,
  HitResult,
  SerializedDrawing,
} from '../types';
import { DRAG_PLACE_PX, PlacementSession } from './placement';

type Drag =
  | { kind: 'anchor'; id: string; anchor: number; before: SerializedDrawing }
  | { kind: 'body'; id: string; before: SerializedDrawing; startIndex: number; startY: number }
  | { kind: 'place'; downX: number; downY: number };

export interface HoverState {
  readonly id: string | null;
  readonly anchor: number | null;
}

/**
 * Pointer workflow for drawings: TradingView-style placement (click-click, press-drag, path
 * clicks, freehand, single click) and editing (hover, select, anchor drag, body drag).
 */
export class DrawingInteraction implements InteractionHandler {
  readonly id = 'drawings';
  readonly priority = 50;
  placement: PlacementSession | null = null;
  hover: HoverState = { id: null, anchor: null };
  private drag: Drag | null = null;
  /** Text editing opens on pointer-up so the browser's mousedown focus can't steal it. */
  private pendingTextEdit: string | null = null;

  constructor(private readonly m: DrawingManager) {}

  get busy(): boolean {
    return this.placement !== null || (this.drag !== null && this.drag.kind !== 'place');
  }

  // ---- snapping -----------------------------------------------------------------------------

  private magnet(e: ChartPointerEvent): MagnetMode {
    const mode = this.m.modes.magnet;
    if (!e.ctrl) return mode;
    return mode === 'off' ? 'strong' : 'off'; // Ctrl temporarily toggles the magnet
  }

  private pointAt(
    e: ChartPointerEvent,
    def: AnyToolDefinition | undefined,
    reference: ChartPoint | null,
  ): ChartPoint {
    const dc = this.m.context();
    let x = e.x;
    let y = e.y;
    if (reference && e.shift && def?.angleConstraint) {
      const c = constrainAngle(toPixel(reference, dc), { x, y });
      x = c.x;
      y = c.y;
    }
    const p = fromPixel(x, y, dc, def?.snapToBars !== false);
    if (e.shift && def?.angleConstraint && reference) return p;
    return {
      time: p.time,
      price: snapPrice(dc.coords.timeToIndex(p.time), p.price, this.magnet(e), dc),
    };
  }

  // ---- placement ----------------------------------------------------------------------------

  private startPlacement(def: AnyToolDefinition, e: ChartPointerEvent): void {
    const style = this.m.defaults.resolve(def, this.m.engine.getTheme());
    const p = this.pointAt(e, def, null);
    this.placement = new PlacementSession(def, this.m.newId(), style, p, () => this.m.context());
    if (this.placement.immediate) this.finishPlacement();
  }

  private finishPlacement(): void {
    const session = this.placement;
    if (!session) return;
    this.placement = null;
    this.drag = null;
    if (!session.canFinish()) return this.m.invalidate();
    const drawing = session.finish();
    const stay = this.m.modes.stayInDrawingMode;
    if (!stay) this.m.setTool(null);
    this.m.add([drawing], !stay);
    if (session.def.editTextOnCreate) {
      this.m.select(drawing.id);
      this.pendingTextEdit = drawing.id;
    }
  }

  cancelPlacement(): void {
    if (!this.placement) return;
    this.placement = null;
    this.drag = null;
    this.m.invalidate();
  }

  escape(): boolean {
    if (this.drag && this.drag.kind !== 'place') {
      this.onCancel();
      return true;
    }
    if (!this.placement) return false;
    if (this.placement.def.placement.kind === 'polyline' && this.placement.canFinish())
      this.finishPlacement();
    else this.cancelPlacement();
    return true;
  }

  confirm(): boolean {
    if (!this.placement?.canFinish()) return false;
    this.finishPlacement();
    return true;
  }

  // ---- hit testing --------------------------------------------------------------------------

  private hitTest(x: number, y: number): { drawing: Drawing; hit: HitResult } | null {
    if (this.m.modes.hideAll) return null;
    const dc = this.m.context();
    const list = this.m.store.all();
    const selected = this.m.selected;
    if (selected && !selected.hidden) {
      const hit = selected.hitTest(x, y, dc);
      if (hit?.part === 'anchor') return { drawing: selected, hit };
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]!;
      if (d.hidden) continue;
      const hit = d.hitTest(x, y, dc);
      if (hit) return { drawing: d, hit };
    }
    return null;
  }

  private setHover(id: string | null, anchor: number | null): void {
    if (this.hover.id === id && this.hover.anchor === anchor) return;
    this.hover = { id, anchor };
    this.m.invalidate();
  }

  private editable(d: Drawing): boolean {
    return !d.locked && !this.m.modes.lockAll;
  }

  // ---- InteractionHandler -------------------------------------------------------------------

  onHover(e: ChartPointerEvent): string | null {
    if (this.placement) {
      this.placement.move(this.pointAt(e, this.placement.def, this.placement.lastClick));
      this.m.invalidate();
      return 'crosshair';
    }
    if (this.m.tool) {
      this.setHover(null, null);
      return 'crosshair';
    }
    const found = e.region === 'price-pane' ? this.hitTest(e.x, e.y) : null;
    this.setHover(found?.drawing.id ?? null, found?.hit.anchor ?? null);
    if (!found) return null;
    return this.editable(found.drawing) ? found.hit.cursor : 'default';
  }

  onPointerLeave(): void {
    this.setHover(null, null);
  }

  onPointerDown(e: ChartPointerEvent): boolean {
    if (e.region !== 'price-pane') return false;
    const toolId = this.m.tool;
    if (this.placement) {
      if (this.placement.def.placement.kind === 'freehand') return true;
      const step = this.placement.click(
        this.pointAt(e, this.placement.def, this.placement.lastClick),
      );
      if (step === 'done') this.finishPlacement();
      else this.drag = { kind: 'place', downX: e.x, downY: e.y };
      this.m.invalidate();
      return true;
    }
    if (toolId && !this.m.modes.hideAll && !this.m.modes.lockAll) {
      const def = this.m.definition(toolId);
      if (!def) return false;
      this.startPlacement(def, e);
      if (this.placement) this.drag = { kind: 'place', downX: e.x, downY: e.y };
      this.m.invalidate();
      return true;
    }
    const found = this.hitTest(e.x, e.y);
    if (!found) {
      this.m.select(null);
      return false;
    }
    const d = found.drawing;
    this.m.select(d.id);
    if (!this.editable(d)) return true;
    const before = d.serialize();
    this.drag =
      found.hit.part === 'anchor'
        ? { kind: 'anchor', id: d.id, anchor: found.hit.anchor ?? 0, before }
        : { kind: 'body', id: d.id, before, startIndex: Math.round(e.index), startY: e.y };
    return true;
  }

  onPointerMove(e: ChartPointerEvent): void {
    const drag = this.drag;
    if (this.placement) {
      this.placement.move(this.pointAt(e, this.placement.def, this.placement.lastClick));
      this.m.invalidate();
      return;
    }
    if (!drag || drag.kind === 'place') return;
    const d = this.m.store.get(drag.id);
    if (!d) return;
    const dc = this.m.context();
    if (drag.kind === 'anchor') {
      const def = this.m.definition(d.type);
      const ref =
        d.points.length === 2 && drag.anchor < 2
          ? (drag.before.points[1 - drag.anchor] ?? null)
          : null;
      d.moveAnchor(drag.anchor, this.pointAt(e, def, ref), dc, { shift: e.shift });
    } else {
      const dBars = Math.round(e.index) - drag.startIndex;
      const dy = e.y - drag.startY;
      d.points = drag.before.points.map((p) => shiftPoint(p, dBars, dy, dc));
    }
    this.m.store.touch(d.id);
  }

  onPointerUp(e: ChartPointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    if (this.pendingTextEdit) {
      this.m.events.emit('text:edit', { id: this.pendingTextEdit });
      this.pendingTextEdit = null;
    }
    if (this.placement) {
      const kind = this.placement.def.placement.kind;
      if (kind === 'freehand') return this.finishPlacement();
      const moved =
        drag?.kind === 'place' && distance({ x: drag.downX, y: drag.downY }, e) > DRAG_PLACE_PX;
      if (moved && this.placement.committed.length === 1) {
        const step = this.placement.dragRelease(
          this.pointAt(e, this.placement.def, this.placement.lastClick),
        );
        if (step === 'done') this.finishPlacement();
      }
      return;
    }
    if (drag && drag.kind !== 'place') {
      this.m.commit(
        drag.id,
        drag.before,
        drag.kind === 'anchor' ? 'Reshape drawing' : 'Move drawing',
      );
    }
  }

  onCancel(): void {
    const drag = this.drag;
    this.drag = null;
    if (drag && drag.kind !== 'place') this.m.preview(drag.id, drag.before);
    this.cancelPlacement();
  }

  onDoubleClick(e: ChartPointerEvent): boolean {
    if (this.placement) {
      if (this.placement.def.placement.kind === 'polyline') {
        this.finishPlacement();
        return true;
      }
      return false;
    }
    const found = this.hitTest(e.x, e.y);
    if (!found) return false;
    const d = found.drawing;
    this.m.select(d.id);
    // Point-editable tools (Path): double-click a segment inserts a point, an anchor removes it.
    if (found.hit.part === 'body' && d.insertPointAt && this.editable(d)) {
      this.m.update(d.id, (x) => void x.insertPointAt?.(e.x, e.y, this.m.context()), 'Add point');
    } else if (found.hit.part === 'anchor' && d.removePoint && this.editable(d)) {
      this.m.update(d.id, (x) => void x.removePoint?.(found.hit.anchor ?? -1), 'Remove point');
    } else if (d.textKey && this.editable(d)) {
      this.m.events.emit('text:edit', { id: d.id });
    } else {
      this.m.events.emit('settings:open', { id: d.id });
    }
    return true;
  }

  onContextMenu(e: ChartPointerEvent): boolean {
    if (this.placement) {
      this.escape();
      return true;
    }
    const found = this.hitTest(e.x, e.y);
    if (!found) return false;
    this.m.select(found.drawing.id);
    this.m.events.emit('contextmenu', {
      id: found.drawing.id,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    return true;
  }

  /** Keyboard nudge as one undoable step (repeats merge). */
  nudge(d: Drawing, dBars: number, dyPx: number): void {
    const dc = this.m.context();
    this.m.update(
      d.id,
      (x) => void (x.points = x.points.map((p) => shiftPoint(p, dBars, dyPx, dc))),
      'Move drawing',
      true,
    );
  }
}
