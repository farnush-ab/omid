import { describe, expect, it, vi } from 'vitest';
import {
  CommandHistory,
  CompositeCommand,
  EventBus,
  Registry,
  createRng,
  type Command,
} from '@/lib/core';
import { RenderLoop } from '@/lib/core/render/render-loop';

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<{ a: number; b: string }>();
    const fn = vi.fn();
    const off = bus.on('a', fn);
    bus.emit('a', 1);
    off();
    bus.emit('a', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('supports once', () => {
    const bus = new EventBus<{ a: number }>();
    const fn = vi.fn();
    bus.once('a', fn);
    bus.emit('a', 1);
    bus.emit('a', 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

class Inc implements Command {
  constructor(
    readonly box: { v: number },
    readonly by: number,
    readonly label = 'inc',
  ) {}
  execute() {
    this.box.v += this.by;
  }
  undo() {
    this.box.v -= this.by;
  }
}

describe('CommandHistory', () => {
  it('undoes and redoes in order', () => {
    const box = { v: 0 };
    const h = new CommandHistory();
    h.execute(new Inc(box, 1));
    h.execute(new Inc(box, 10));
    expect(box.v).toBe(11);
    h.undo();
    expect(box.v).toBe(1);
    h.undo();
    expect(box.v).toBe(0);
    expect(h.state.canUndo).toBe(false);
    h.redo();
    h.redo();
    expect(box.v).toBe(11);
  });

  it('clears redo on new command and respects the limit', () => {
    const box = { v: 0 };
    const h = new CommandHistory(3);
    for (let i = 0; i < 5; i++) h.execute(new Inc(box, 1));
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(3);
    h.execute(new Inc(box, 1));
    expect(h.state.canRedo).toBe(false);
  });

  it('merges mergeable commands', () => {
    const box = { v: 0 };
    const h = new CommandHistory();
    class M extends Inc {
      merge(next: Command) {
        if (!(next instanceof M)) return false;
        return true;
      }
    }
    h.execute(new M(box, 1), { mergeable: true });
    h.execute(new M(box, 1), { mergeable: true });
    expect(box.v).toBe(2);
    h.undo();
    expect(box.v).toBe(1);
  });

  it('runs composite commands as one step', () => {
    const box = { v: 0 };
    const h = new CommandHistory();
    h.execute(new CompositeCommand('both', [new Inc(box, 1), new Inc(box, 2)]));
    expect(box.v).toBe(3);
    h.undo();
    expect(box.v).toBe(0);
  });

  it('notifies listeners with a revision', () => {
    const h = new CommandHistory();
    const fn = vi.fn();
    h.onChange(fn);
    h.execute(new Inc({ v: 0 }, 1));
    expect(fn.mock.calls[0]![0].revision).toBe(1);
  });
});

describe('RenderLoop', () => {
  it('coalesces invalidations into one frame with the union mask', () => {
    const queue: Array<() => void> = [];
    const frames = { request: (cb: () => void) => queue.push(cb), cancel: vi.fn() };
    const onFrame = vi.fn();
    const loop = new RenderLoop(frames, onFrame);
    loop.invalidate(1);
    loop.invalidate(4);
    expect(queue).toHaveLength(1);
    queue[0]!();
    expect(onFrame).toHaveBeenCalledWith(5);
  });
});

describe('Registry & Rng', () => {
  it('rejects duplicate ids', () => {
    const r = new Registry<{ id: string }>('R');
    r.register({ id: 'a' });
    expect(() => r.register({ id: 'a' })).toThrow();
    expect(r.ids()).toEqual(['a']);
  });

  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
  });
});
