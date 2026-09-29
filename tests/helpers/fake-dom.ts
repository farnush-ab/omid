import type { EngineRuntime, FrameScheduler } from '@/lib/core';
import { ManualTimer } from './fake-engine';

/** 2D context stand-in: every method is a no-op, measureText is proportional. */
function fakeCtx(): CanvasRenderingContext2D {
  const target: Record<string | symbol, unknown> = {
    measureText: (t: string) => ({ width: t.length * 7 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    getLineDash: () => [],
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => undefined),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

interface FakeElement {
  style: Record<string, string>;
  children: FakeElement[];
  width: number;
  height: number;
  setAttribute(): void;
  appendChild(c: FakeElement): FakeElement;
  remove(): void;
  addEventListener(): void;
  removeEventListener(): void;
  getContext(): CanvasRenderingContext2D;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  ownerDocument: { createElement(): FakeElement };
}

let observers: Array<{ cb: ResizeObserverCallback; el: unknown }> = [];

class FakeResizeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(el: unknown) {
    observers.push({ cb: this.cb, el });
  }
  disconnect() {
    observers = observers.filter((o) => o.cb !== this.cb);
  }
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;

/** A detached container the ChartEngine can mount into under Node. */
export function fakeContainer(width = 1000, height = 600) {
  const size = { width, height };
  const make = (): FakeElement => {
    const el: FakeElement = {
      style: {},
      children: [],
      width: 0,
      height: 0,
      setAttribute: () => undefined,
      appendChild: (c) => (el.children.push(c), c),
      remove: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      getContext: () => fakeCtx(),
      getBoundingClientRect: () => ({ left: 0, top: 0, ...size }),
      ownerDocument: doc,
    };
    return el;
  };
  const doc = { createElement: make };
  const container = make();
  return {
    container: container as unknown as HTMLElement,
    resize(w: number, h: number) {
      size.width = w;
      size.height = h;
      for (const o of observers.filter((x) => x.el === container))
        o.cb(
          [{ contentRect: { width: w, height: h } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
    },
  };
}

/** Frame scheduler that runs queued frames on `flush()`. */
export class ManualFrames implements FrameScheduler {
  private seq = 0;
  private queue = new Map<number, () => void>();
  request = (cb: () => void) => {
    this.queue.set(++this.seq, cb);
    return this.seq;
  };
  cancel = (h: number) => void this.queue.delete(h);
  flush(): void {
    const cbs = [...this.queue.values()];
    this.queue.clear();
    cbs.forEach((cb) => cb());
  }
}

export function fakeRuntime(now: { now(): number }) {
  const frames = new ManualFrames();
  const timer = new ManualTimer();
  const runtime: EngineRuntime = { frames, timer, clock: now, devicePixelRatio: () => 1 };
  return { runtime, frames, timer };
}
