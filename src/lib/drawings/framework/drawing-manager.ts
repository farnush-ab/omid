import {
  EventBus,
  LayerMask,
  formatPrice,
  type ChartEngine,
  type CommandHistory,
  type IdGenerator,
} from '@/lib/core';
import {
  AddDrawingsCommand,
  RemoveDrawingsCommand,
  ReorderDrawingCommand,
  UpdateDrawingCommand,
} from './commands';
import { DrawingStore } from './drawing-store';
import type { DrawingEventMap, DrawingModes } from './events';
import { DrawingInteraction } from './interaction/drawing-interaction';
import { snapPrice, type MagnetMode } from './magnet';
import type { DrawingRegistry } from './registry';
import { createDrawingsRenderer } from './drawings-renderer';
import { cloneSerialized, deserializeDrawing } from './serialization';
import { ToolDefaults } from './tool-defaults';
import type {
  AnyToolDefinition,
  ChartPoint,
  Drawing,
  DrawingContext,
  DrawingStyle,
  SerializedDrawing,
} from './types';

export type ZOrder = 'front' | 'back' | 'forward' | 'backward';

/**
 * Owns drawings, selection, the active tool and drawing modes. Every mutation goes through the
 * shared CommandHistory. Plugs into the engine via a renderer, an interaction handler and a
 * price-range contributor — the engine itself knows nothing about drawings.
 */
export class DrawingManager {
  readonly events = new EventBus<DrawingEventMap>();
  readonly store = new DrawingStore();
  readonly defaults = new ToolDefaults();
  private selectedId: string | null = null;
  private activeTool: string | null = null;
  private modeState: DrawingModes = {
    magnet: 'off',
    stayInDrawingMode: false,
    lockAll: false,
    hideAll: false,
  };
  private clipboard: SerializedDrawing[] = [];
  private readonly interaction: DrawingInteraction;
  private readonly disposers: Array<() => void> = [];

  constructor(
    readonly engine: ChartEngine,
    readonly history: CommandHistory,
    readonly registry: DrawingRegistry,
    readonly newId: IdGenerator,
  ) {
    this.interaction = new DrawingInteraction(this);
    this.disposers.push(
      engine.addRenderer('drawings', createDrawingsRenderer(this, this.interaction)),
      engine.addInteractionHandler(this.interaction),
      engine.addPriceRangeContributor((from, to) => this.priceRange(from, to)),
      this.store.onChange((c) => {
        if (c.kind === 'remove' && c.id === this.selectedId) this.select(null);
        if (c.kind === 'reset' && this.selectedId && !this.store.get(this.selectedId))
          this.select(null);
        if (c.kind !== 'reset' && c.kind !== 'remove')
          this.events.emit('drawing:updated', { id: c.id });
        this.events.emit('drawings:changed', { count: this.store.size });
        this.invalidate();
      }),
    );
    engine.setCrosshairSnapper((index, price) =>
      this.modeState.magnet === 'off'
        ? null
        : snapPrice(index, price, this.modeState.magnet, this.context()),
    );
  }

  // ---- context ------------------------------------------------------------------------------

  context(): DrawingContext {
    const e = this.engine;
    const opts = e.getOptions();
    const symbol = e.getSymbol();
    const precision = opts.pricePrecision >= 0 ? opts.pricePrecision : symbol.pricePrecision;
    return {
      coords: e.coords,
      data: e.seriesData,
      symbol,
      timeframe: e.getTimeframe(),
      theme: e.getTheme(),
      pane: e.getLayout().pricePane,
      dpr: 1,
      formatPrice: (p) => formatPrice(p, precision),
      measureText: (t, f) => e.measureText(t, f),
    };
  }

  invalidate(): void {
    this.engine.invalidate(LayerMask.drawings);
  }

  definition(type: string): AnyToolDefinition | undefined {
    return this.registry.get(type);
  }

  // ---- tools & modes ----------------------------------------------------------------------

  get tool(): string | null {
    return this.activeTool;
  }

  setTool(id: string | null): void {
    const next = id && this.registry.has(id) ? id : null;
    this.interaction.cancelPlacement();
    if (next) this.select(null);
    if (next === this.activeTool) return;
    this.activeTool = next;
    this.events.emit('tool:changed', { tool: next });
  }

  get modes(): DrawingModes {
    return this.modeState;
  }

  setModes(patch: Partial<DrawingModes>): void {
    this.modeState = { ...this.modeState, ...patch };
    if (patch.hideAll || patch.lockAll) this.interaction.cancelPlacement();
    if (patch.hideAll) this.select(null);
    this.events.emit('modes:changed', this.modeState);
    this.invalidate();
    this.engine.invalidate(LayerMask.overlay);
  }

  setMagnet(magnet: MagnetMode): void {
    this.setModes({ magnet });
  }

  // ---- selection --------------------------------------------------------------------------

  get selected(): Drawing | null {
    return this.selectedId ? (this.store.get(this.selectedId) ?? null) : null;
  }

  select(id: string | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.events.emit('selection:changed', { id });
    this.invalidate();
  }

  // ---- mutations (all undoable) -----------------------------------------------------------

  /** Builds a new drawing of `type` with the resolved default style. */
  createDrawing(type: string, points: readonly ChartPoint[], style?: DrawingStyle): Drawing | null {
    const def = this.registry.get(type);
    if (!def) return null;
    return def.create({
      id: this.newId(),
      points,
      style: style ?? this.defaults.resolve(def, this.engine.getTheme()),
    });
  }

  add(drawings: readonly Drawing[], select = true): void {
    if (drawings.length === 0) return;
    this.history.execute(new AddDrawingsCommand(this.store, drawings));
    if (select) this.select(drawings[drawings.length - 1]!.id);
  }

  remove(ids: readonly string[]): void {
    const existing = ids.filter((id) => this.store.get(id));
    if (existing.length) this.history.execute(new RemoveDrawingsCommand(this.store, existing));
  }

  removeSelected(): void {
    if (this.selectedId) this.remove([this.selectedId]);
  }

  removeAll(): void {
    this.remove(this.store.all().map((d) => d.id));
  }

  /** Records an edit whose live changes were already applied (drag, dialog OK). */
  commit(id: string, before: SerializedDrawing, label = 'Edit drawing', mergeable = false): void {
    const d = this.store.get(id);
    if (!d) return;
    const after = d.serialize();
    if (JSON.stringify(after) === JSON.stringify(before)) return;
    this.history.execute(new UpdateDrawingCommand(this.store, id, before, after, label), {
      mergeable,
    });
  }

  /** Applies a change as one undoable step. */
  update(
    id: string,
    change: (d: Drawing) => void,
    label = 'Edit drawing',
    mergeable = false,
  ): void {
    const d = this.store.get(id);
    if (!d) return;
    const before = d.serialize();
    change(d);
    const after = d.serialize();
    this.store.apply(id, before);
    if (JSON.stringify(after) === JSON.stringify(before)) return;
    this.history.execute(new UpdateDrawingCommand(this.store, id, before, after, label), {
      mergeable,
    });
  }

  updateStyle(id: string, patch: DrawingStyle, mergeable = true): void {
    this.update(id, (d) => void (d.style = { ...d.style, ...patch }), 'Change style', mergeable);
  }

  setPoints(id: string, points: readonly ChartPoint[]): void {
    this.update(id, (d) => void (d.points = points.map((p) => ({ ...p }))), 'Move drawing');
  }

  setLocked(id: string, locked: boolean): void {
    this.update(id, (d) => void (d.locked = locked), locked ? 'Lock drawing' : 'Unlock drawing');
  }

  setHidden(id: string, hidden: boolean): void {
    this.update(id, (d) => void (d.hidden = hidden), hidden ? 'Hide drawing' : 'Show drawing');
  }

  /** Live, non-recorded change (settings-dialog preview). Pair with commit()/restore(). */
  preview(id: string, snap: SerializedDrawing): void {
    this.store.apply(id, snap);
  }

  reorder(id: string, where: ZOrder): void {
    const from = this.store.indexOf(id);
    if (from < 0) return;
    const last = this.store.size - 1;
    const to = {
      front: last,
      back: 0,
      forward: Math.min(last, from + 1),
      backward: Math.max(0, from - 1),
    }[where];
    if (to !== from) this.history.execute(new ReorderDrawingCommand(this.store, id, from, to));
  }

  clone(id: string, offsetBars = 0): Drawing | null {
    const d = this.store.get(id);
    if (!d) return null;
    const copy = this.fromSnapshot(
      { ...cloneSerialized(d.serialize()), id: this.newId(), locked: false },
      offsetBars,
    );
    if (copy) this.add([copy]);
    return copy;
  }

  // ---- clipboard ----------------------------------------------------------------------------

  copySelected(): boolean {
    const d = this.selected;
    if (!d) return false;
    this.clipboard = [cloneSerialized(d.serialize())];
    return true;
  }

  paste(offsetBars = 3): void {
    const copies = this.clipboard
      .map((s) =>
        this.fromSnapshot({ ...cloneSerialized(s), id: this.newId(), locked: false }, offsetBars),
      )
      .filter((d): d is Drawing => d !== null);
    this.add(copies);
    this.clipboard = copies.map((c) => c.serialize());
  }

  private fromSnapshot(snap: SerializedDrawing, offsetBars: number): Drawing | null {
    const res = deserializeDrawing(snap, this.registry);
    if (!res.ok) return null;
    if (offsetBars) {
      const c = this.engine.coords;
      res.drawing.points = res.drawing.points.map((p) => ({
        time: c.indexToTime(c.timeToIndex(p.time) + offsetBars),
        price: p.price,
      }));
    }
    return res.drawing;
  }

  /** Arrow-key nudge of the selected drawing (bars horizontally, pixels vertically). */
  nudge(dBars: number, dyPx: number): void {
    const d = this.selected;
    if (!d || d.locked || this.modeState.lockAll) return;
    this.interaction.nudge(d, dBars, dyPx);
  }

  // ---- keyboard -----------------------------------------------------------------------------

  /** Esc: finish/cancel placement, else leave the tool, else deselect. Returns true if handled. */
  escape(): boolean {
    if (this.interaction.escape()) return true;
    if (this.activeTool) {
      this.setTool(null);
      return true;
    }
    if (this.selectedId) {
      this.select(null);
      return true;
    }
    return false;
  }

  /** Enter: finish a multi-point placement. */
  confirm(): boolean {
    return this.interaction.confirm();
  }

  get isBusy(): boolean {
    return this.interaction.busy;
  }

  // ---- bulk ---------------------------------------------------------------------------------

  /** Replaces all drawings (symbol switch / import). Not undoable. */
  load(drawings: readonly Drawing[]): void {
    this.interaction.cancelPlacement();
    this.store.reset(drawings);
  }

  serializeAll(): SerializedDrawing[] {
    return this.store.all().map((d) => d.serialize());
  }

  private priceRange(fromTime: number, toTime: number): { min: number; max: number } | null {
    if (this.modeState.hideAll || this.interaction.busy) return null;
    let out: { min: number; max: number } | null = null;
    for (const d of this.store.all()) {
      if (d.hidden || !d.priceRange || d.points.length === 0) continue;
      const times = d.points.map((p) => p.time);
      if (Math.max(...times) < fromTime || Math.min(...times) > toTime) continue;
      const r = d.priceRange();
      if (r) out = out ? { min: Math.min(out.min, r.min), max: Math.max(out.max, r.max) } : r;
    }
    return out;
  }

  destroy(): void {
    for (const d of this.disposers.splice(0)) d();
    this.engine.setCrosshairSnapper(null);
    this.events.clear();
  }
}
