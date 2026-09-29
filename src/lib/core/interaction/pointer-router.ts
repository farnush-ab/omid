import { ENGINE_CONFIG } from '../config';
import type { Timer } from '../contracts/runtime';
import type { ChartPointerEvent, InteractionHandler, NavigationTarget, PointerLike } from './types';

type Mode = 'none' | 'pan' | 'handler' | 'price-axis' | 'time-axis' | 'pinch' | 'touch-crosshair';

const { longPressMs, moveTolerancePx } = ENGINE_CONFIG.touch;
const WHEEL_LINE_PX = 16;

/**
 * Translates DOM pointer/wheel events into chart gestures. Plugins get first refusal through
 * InteractionHandlers; unclaimed gestures fall back to navigation (pan, zoom, axis scaling).
 */
export class PointerRouter {
  private mode: Mode = 'none';
  private captured: InteractionHandler | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private last = { x: 0, y: 0 };
  private down = { x: 0, y: 0 };
  private longPress: number | null = null;
  private pinch = { dist: 0, midX: 0, midY: 0 };
  private readonly listeners: Array<[string, EventListener, AddEventListenerOptions | undefined]> =
    [];

  constructor(
    private readonly el: HTMLElement,
    private readonly target: NavigationTarget,
    private readonly timer: Timer,
  ) {
    this.listen('pointerdown', (e) => this.onDown(e as PointerEvent));
    this.listen('pointermove', (e) => this.onMove(e as PointerEvent));
    this.listen('pointerup', (e) => this.onUp(e as PointerEvent, false));
    this.listen('pointercancel', (e) => this.onUp(e as PointerEvent, true));
    this.listen('pointerleave', (e) => this.onLeave(e as PointerEvent));
    this.listen('wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.listen('dblclick', (e) => this.onDblClick(e as MouseEvent));
    this.listen('contextmenu', (e) => this.onContextMenu(e as MouseEvent));
  }

  destroy(): void {
    for (const [type, fn, opts] of this.listeners) this.el.removeEventListener(type, fn, opts);
    this.listeners.length = 0;
    this.clearLongPress();
  }

  private listen(type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    this.el.addEventListener(type, fn, opts);
    this.listeners.push([type, fn, opts]);
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private event(e: PointerLike): ChartPointerEvent {
    const p = this.local(e);
    return this.target.toChartEvent(p.x, p.y, e);
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.last = p;
    this.down = p;

    if (this.pointers.size === 2) {
      this.captured?.onCancel?.();
      this.captured = null;
      this.clearLongPress();
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) return;

    const region = this.target.regionAt(p.x, p.y);
    if (region === 'price-axis' || region === 'volume-axis') {
      this.mode = 'price-axis';
      return;
    }
    if (region === 'time-axis') {
      this.mode = 'time-axis';
      return;
    }
    if (region !== 'price-pane' && region !== 'volume-pane') return;
    const ev = this.target.toChartEvent(p.x, p.y, e);
    for (const h of this.target.handlers()) {
      if (h.onPointerDown?.(ev)) {
        this.captured = h;
        this.mode = 'handler';
        this.target.setCrosshair(p.x, p.y, ev);
        return;
      }
    }
    this.mode = 'pan';
    if (e.pointerType === 'touch') {
      this.longPress = this.timer.setTimeout(() => {
        this.longPress = null;
        if (this.mode !== 'pan') return;
        this.mode = 'touch-crosshair';
        this.target.setCrosshair(
          this.last.x,
          this.last.y,
          this.target.toChartEvent(this.last.x, this.last.y, e),
        );
      }, longPressMs);
    }
  }

  private onMove(e: PointerEvent): void {
    const p = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    const dx = p.x - this.last.x;
    const dy = p.y - this.last.y;
    this.last = p;

    switch (this.mode) {
      case 'pinch':
        this.updatePinch();
        return;
      case 'pan':
        if (Math.hypot(p.x - this.down.x, p.y - this.down.y) > moveTolerancePx)
          this.clearLongPress();
        this.target.panBy(dx, dy);
        if (e.pointerType === 'mouse') this.target.setCrosshair(p.x, p.y, this.event(e));
        return;
      case 'touch-crosshair':
        this.target.setCrosshair(p.x, p.y, this.event(e));
        return;
      case 'handler': {
        const ev = this.event(e);
        this.captured?.onPointerMove?.(ev);
        this.target.setCrosshair(p.x, p.y, ev);
        return;
      }
      case 'price-axis':
        this.target.scalePrice(dy);
        return;
      case 'time-axis':
        this.target.scaleTime(dx);
        return;
      case 'none':
        this.hover(e, p);
    }
  }

  private hover(e: PointerEvent, p: { x: number; y: number }): void {
    const region = this.target.regionAt(p.x, p.y);
    if (region !== 'price-pane' && region !== 'volume-pane') {
      this.target.clearCrosshair();
      this.target.setCursor(this.target.defaultCursor(region));
      return;
    }
    const ev = this.target.toChartEvent(p.x, p.y, e);
    this.target.setCrosshair(p.x, p.y, ev);
    let cursor: string | null = null;
    for (const h of this.target.handlers()) {
      const c = h.onHover?.(ev) ?? null;
      if (cursor === null && c !== null) cursor = c;
    }
    this.target.setCursor(cursor ?? this.target.defaultCursor(region));
  }

  private onUp(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    this.clearLongPress();
    if (this.mode === 'handler' && this.captured) {
      if (cancelled) this.captured.onCancel?.();
      else this.captured.onPointerUp?.(this.event(e));
    }
    if (this.mode === 'touch-crosshair') this.target.clearCrosshair();
    this.captured = null;
    if (this.mode === 'pinch' && this.pointers.size === 1) {
      this.mode = 'pan';
      this.last = [...this.pointers.values()][0]!;
      this.down = this.last;
      return;
    }
    if (this.pointers.size === 0) {
      this.mode = 'none';
      this.target.gestureEnd();
    }
  }

  private onLeave(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.mode !== 'none') return;
    this.target.clearCrosshair();
    for (const h of this.target.handlers()) h.onPointerLeave?.();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    const region = this.target.regionAt(p.x, p.y);
    if (region === 'price-axis' || region === 'volume-axis') {
      this.target.scalePrice(dy * 0.25);
      return;
    }
    if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
      this.target.panBy(-dx, 0);
      return;
    }
    const { wheelStep, maxWheelFactor } = ENGINE_CONFIG.zoom;
    const step = e.ctrlKey ? wheelStep * 6 : wheelStep;
    const factor = Math.min(maxWheelFactor, Math.max(1 / maxWheelFactor, Math.exp(-dy * step)));
    this.target.zoomTimeAt(p.x, factor);
  }

  private onDblClick(e: MouseEvent): void {
    const p = this.local(e);
    const region = this.target.regionAt(p.x, p.y);
    if (region === 'price-axis' || region === 'volume-axis') return this.target.resetPriceScale();
    if (region === 'time-axis') return this.target.resetTimeScale();
    const ev = this.target.toChartEvent(p.x, p.y, e);
    for (const h of this.target.handlers()) if (h.onDoubleClick?.(ev)) return;
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const p = this.local(e);
    const region = this.target.regionAt(p.x, p.y);
    if (region !== 'price-pane' && region !== 'volume-pane') return;
    const ev = this.target.toChartEvent(p.x, p.y, e);
    for (const h of this.target.handlers()) if (h.onContextMenu?.(ev)) return;
    this.target.contextMenu(ev);
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    this.mode = 'pinch';
    this.pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  }

  private updatePinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    this.target.panBy(midX - this.pinch.midX, midY - this.pinch.midY);
    if (this.pinch.dist > 0 && dist > 0) this.target.zoomTimeAt(midX, dist / this.pinch.dist);
    this.pinch = { dist, midX, midY };
  }

  private clearLongPress(): void {
    if (this.longPress !== null) this.timer.clearTimeout(this.longPress);
    this.longPress = null;
  }
}
