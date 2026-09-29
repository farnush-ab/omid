import type { Command } from '@/lib/core';
import type { DrawingStore } from './drawing-store';
import type { Drawing, SerializedDrawing } from './types';

export class AddDrawingsCommand implements Command {
  constructor(
    private readonly store: DrawingStore,
    private readonly drawings: readonly Drawing[],
    readonly label = drawings.length === 1
      ? `Add ${drawings[0]!.type}`
      : `Add ${drawings.length} drawings`,
  ) {}

  execute(): void {
    for (const d of this.drawings) this.store.insert(d);
  }

  undo(): void {
    for (const d of this.drawings) this.store.remove(d.id);
  }
}

export class RemoveDrawingsCommand implements Command {
  private removed: Array<{ drawing: Drawing; index: number }> = [];

  constructor(
    private readonly store: DrawingStore,
    private readonly ids: readonly string[],
    readonly label = ids.length === 1 ? 'Remove drawing' : 'Remove drawings',
  ) {}

  execute(): void {
    this.removed = [];
    for (const id of this.ids) {
      const r = this.store.remove(id);
      if (r) this.removed.push(r);
    }
  }

  undo(): void {
    for (const r of [...this.removed].reverse()) this.store.insert(r.drawing, r.index);
  }
}

/** Generic snapshot update: points, style, lock and visibility changes all use this. */
export class UpdateDrawingCommand implements Command {
  constructor(
    private readonly store: DrawingStore,
    readonly id: string,
    private readonly before: SerializedDrawing,
    private after: SerializedDrawing,
    readonly label = 'Edit drawing',
  ) {}

  execute(): void {
    this.store.apply(this.id, this.after);
  }

  undo(): void {
    this.store.apply(this.id, this.before);
  }

  merge(next: Command): boolean {
    if (!(next instanceof UpdateDrawingCommand) || next.id !== this.id) return false;
    this.after = next.after;
    return true;
  }
}

export class ReorderDrawingCommand implements Command {
  readonly label = 'Change visual order';

  constructor(
    private readonly store: DrawingStore,
    private readonly id: string,
    private readonly from: number,
    private readonly to: number,
  ) {}

  execute(): void {
    this.store.move(this.id, this.to);
  }

  undo(): void {
    this.store.move(this.id, this.from);
  }
}
