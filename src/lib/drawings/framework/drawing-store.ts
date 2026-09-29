import type { Drawing, SerializedDrawing } from './types';

export type StoreChange =
  | { readonly kind: 'reset' }
  | { readonly kind: 'add' | 'remove' | 'update' | 'reorder'; readonly id: string };

/** Ordered drawing collection (array order = z-order, last on top). Mutated only by commands. */
export class DrawingStore {
  private list: Drawing[] = [];
  private listeners = new Set<(c: StoreChange) => void>();

  onChange(fn: (c: StoreChange) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  all(): readonly Drawing[] {
    return this.list;
  }

  get size(): number {
    return this.list.length;
  }

  get(id: string): Drawing | undefined {
    return this.list.find((d) => d.id === id);
  }

  indexOf(id: string): number {
    return this.list.findIndex((d) => d.id === id);
  }

  insert(d: Drawing, index = this.list.length): void {
    this.list.splice(Math.max(0, Math.min(index, this.list.length)), 0, d);
    this.emit({ kind: 'add', id: d.id });
  }

  remove(id: string): { drawing: Drawing; index: number } | null {
    const index = this.indexOf(id);
    if (index < 0) return null;
    const [drawing] = this.list.splice(index, 1);
    this.emit({ kind: 'remove', id });
    return { drawing: drawing!, index };
  }

  move(id: string, to: number): void {
    const from = this.indexOf(id);
    if (from < 0) return;
    const [d] = this.list.splice(from, 1);
    this.list.splice(Math.max(0, Math.min(to, this.list.length)), 0, d!);
    this.emit({ kind: 'reorder', id });
  }

  /** Applies a snapshot onto the live object (keeps identity). */
  apply(id: string, snap: SerializedDrawing): void {
    const d = this.get(id);
    if (!d) return;
    d.points = snap.points.map((p) => ({ time: p.time, price: p.price }));
    d.style = structuredClone(snap.style);
    d.locked = snap.locked;
    d.hidden = snap.hidden;
    this.emit({ kind: 'update', id });
  }

  /** Notifies listeners of a live (uncommitted) change, e.g. during a drag. */
  touch(id: string): void {
    this.emit({ kind: 'update', id });
  }

  reset(drawings: readonly Drawing[]): void {
    this.list = [...drawings];
    this.emit({ kind: 'reset' });
  }

  private emit(c: StoreChange): void {
    for (const l of this.listeners) l(c);
  }
}
