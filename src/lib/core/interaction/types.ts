import type { Region } from '../model/layout';

export interface ChartPointerEvent {
  /** Container-relative CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly region: Region;
  readonly pointerType: 'mouse' | 'touch' | 'pen';
  readonly button: number;
  readonly shift: boolean;
  /** Ctrl or Cmd. */
  readonly ctrl: boolean;
  readonly alt: boolean;
  /** Fractional bar index at x. */
  readonly index: number;
  readonly time: number;
  readonly price: number;
}

/**
 * Plugins (drawing tools, replay picker…) implement this to take part in pointer handling.
 * Handlers are offered events in descending priority; returning true captures the gesture.
 */
export interface InteractionHandler {
  readonly id: string;
  readonly priority: number;
  /** Capture a press; subsequent moves/up go to this handler until release. */
  onPointerDown?(e: ChartPointerEvent): boolean;
  onPointerMove?(e: ChartPointerEvent): void;
  onPointerUp?(e: ChartPointerEvent): void;
  /** Hover without buttons. Return a CSS cursor to claim the hover, or null to pass. */
  onHover?(e: ChartPointerEvent): string | null;
  onPointerLeave?(): void;
  onDoubleClick?(e: ChartPointerEvent): boolean;
  onContextMenu?(e: ChartPointerEvent): boolean;
  /** Gesture aborted (pointercancel, second touch). */
  onCancel?(): void;
}

/** What the router needs from the engine. Keeps the router free of engine internals. */
export interface NavigationTarget {
  regionAt(x: number, y: number): Region;
  toChartEvent(x: number, y: number, src: PointerLike): ChartPointerEvent;
  handlers(): readonly InteractionHandler[];
  panBy(dx: number, dy: number): void;
  zoomTimeAt(x: number, factor: number): void;
  scalePrice(dyPx: number): void;
  scaleTime(dxPx: number): void;
  resetPriceScale(): void;
  resetTimeScale(): void;
  setCrosshair(x: number, y: number, e: ChartPointerEvent | null): void;
  clearCrosshair(): void;
  setCursor(cursor: string): void;
  defaultCursor(region: Region): string;
  contextMenu(e: ChartPointerEvent): void;
  gestureEnd(): void;
}

export interface PointerLike {
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerType?: string;
  readonly button?: number;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}
