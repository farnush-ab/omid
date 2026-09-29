import type {
  ChartCoordinates,
  Rect,
  SeriesData,
  SettingsSchema,
  SymbolInfo,
  Theme,
  ThemeColorKey,
  Timeframe,
} from '@/lib/core';
import type { ZodType } from 'zod';

/** A drawing anchor in chart space. Drawings never store pixels. */
export interface ChartPoint {
  readonly time: number;
  readonly price: number;
}

export type DrawingStyle = Record<string, unknown>;

/** Persisted / clipboard / snapshot form of a drawing. */
export interface SerializedDrawing<S extends DrawingStyle = DrawingStyle> {
  readonly id: string;
  readonly type: string;
  readonly points: readonly ChartPoint[];
  readonly style: S;
  readonly locked: boolean;
  readonly hidden: boolean;
}

/** Everything a drawing needs to map itself to pixels and format values. */
export interface DrawingContext {
  readonly coords: ChartCoordinates;
  readonly data: SeriesData;
  readonly symbol: SymbolInfo;
  readonly timeframe: Timeframe;
  readonly theme: Theme;
  readonly pane: Rect;
  readonly dpr: number;
  formatPrice(price: number): string;
  measureText(text: string, font: string): number;
}

export interface DrawingRenderState {
  readonly hovered: boolean;
  readonly selected: boolean;
  /** True while the drawing is being placed (preview). */
  readonly placing: boolean;
}

export interface HitResult {
  readonly part: 'anchor' | 'body';
  readonly anchor?: number;
  readonly cursor: string;
}

export interface AnchorHandle {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly cursor: string;
}

export interface Modifiers {
  readonly shift: boolean;
}

/** The runtime contract every drawing tool implements. */
export interface Drawing<S extends DrawingStyle = DrawingStyle> {
  readonly id: string;
  readonly type: string;
  points: ChartPoint[];
  style: S;
  locked: boolean;
  hidden: boolean;
  render(ctx: CanvasRenderingContext2D, dc: DrawingContext, state: DrawingRenderState): void;
  hitTest(x: number, y: number, dc: DrawingContext): HitResult | null;
  getAnchors(dc: DrawingContext): AnchorHandle[];
  /** Moves anchor `index` to `point` (already snapped). */
  moveAnchor(index: number, point: ChartPoint, dc: DrawingContext, mods: Modifiers): void;
  /** Pixel bounds for viewport culling; null = always render. */
  bounds(dc: DrawingContext): Rect | null;
  /** Price extent for auto-scale (optional). */
  priceRange?(): { min: number; max: number } | null;
  /** Editable text, if the tool supports inline text editing. */
  textKey?: string;
  /** Rect (px) of the editable text box, for the inline editor overlay. */
  textRect?(dc: DrawingContext): Rect | null;
  /** Path-style tools: insert a point near (x, y) / remove point `index`. */
  insertPointAt?(x: number, y: number, dc: DrawingContext): boolean;
  removePoint?(index: number): boolean;
  serialize(): SerializedDrawing<S>;
}

export type PlacementSpec =
  /** Click per point (or press-drag-release for two points). */
  | { readonly kind: 'points'; readonly count: number }
  /** Click per point; double-click / Enter / Esc finishes. */
  | { readonly kind: 'polyline'; readonly min: number }
  /** Press and drag; release finishes. */
  | { readonly kind: 'freehand' }
  /** One click creates it. */
  | { readonly kind: 'single' };

export interface DrawingInit<S extends DrawingStyle> {
  readonly id: string;
  readonly points: readonly ChartPoint[];
  readonly style: S;
  readonly locked?: boolean;
  readonly hidden?: boolean;
}

/**
 * Self-description of a drawing tool — the only thing needed to add a tool to the app:
 * toolbar button, shortcut, placement workflow, settings dialog, floating toolbar, defaults,
 * persistence validation and the factory all derive from it.
 */
export interface DrawingToolDefinition<S extends DrawingStyle = DrawingStyle> {
  readonly id: string;
  readonly label: string;
  /** SVG path data, 24×24. */
  readonly icon: string;
  readonly shortcut?: string;
  readonly placement: PlacementSpec;
  readonly defaults: S;
  /** Validates persisted styles (missing keys are filled from defaults first). */
  readonly styleSchema: ZodType<S>;
  /** Style tabs; the Coordinates tab is generated from the points. */
  readonly settings: SettingsSchema;
  /** Style keys shown in the floating toolbar (colour/opacity/width/style fields). */
  readonly toolbar: readonly string[];
  readonly pointLabels?: readonly string[];
  /** Style keys that take their default from the active theme. */
  readonly themeDefaults?: Readonly<Partial<Record<keyof S & string, ThemeColorKey>>>;
  /** Hold Shift to constrain the moved anchor to 45° steps. */
  readonly angleConstraint?: boolean;
  /** Open the inline text editor right after placement. */
  readonly editTextOnCreate?: boolean;
  /** Snap time to bar centres while placing/moving (default true). */
  readonly snapToBars?: boolean;
  /** Derives the full point list from the placed points (e.g. curve control, position levels). */
  finalizePoints?(points: readonly ChartPoint[], dc: DrawingContext): ChartPoint[];
  create(init: DrawingInit<S>): Drawing<S>;
}

export type AnyToolDefinition = DrawingToolDefinition<DrawingStyle>;
