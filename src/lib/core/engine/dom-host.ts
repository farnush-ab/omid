import { CanvasSurface, type Surface } from '../render/surface';
import { LAYERS, type LayerId } from '../render/layers';

/**
 * The only piece of the engine that creates DOM nodes: a positioned wrapper holding one canvas
 * per layer, observed for size changes.
 */
export class DomHost {
  readonly root: HTMLDivElement;
  readonly surfaces: Record<LayerId, Surface>;
  private readonly observer: ResizeObserver;
  private readonly measureCtx: CanvasRenderingContext2D | null;

  constructor(
    private readonly container: HTMLElement,
    onResize: (width: number, height: number) => void,
  ) {
    const doc = container.ownerDocument;
    this.root = doc.createElement('div');
    Object.assign(this.root.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });
    this.root.setAttribute('data-chart-root', '');
    const entries = LAYERS.map((id) => {
      const canvas = doc.createElement('canvas');
      canvas.setAttribute('data-layer', id);
      Object.assign(canvas.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        pointerEvents: 'none',
      });
      this.root.appendChild(canvas);
      return [id, new CanvasSurface(canvas)] as const;
    });
    this.surfaces = Object.fromEntries(entries) as unknown as Record<LayerId, Surface>;
    container.appendChild(this.root);
    this.measureCtx = doc.createElement('canvas').getContext('2d');

    this.observer = new ResizeObserver((items) => {
      const box = items[0]?.contentRect;
      if (box) onResize(Math.floor(box.width), Math.floor(box.height));
    });
    this.observer.observe(container);
  }

  get size(): { width: number; height: number } {
    const r = this.container.getBoundingClientRect();
    return { width: Math.floor(r.width), height: Math.floor(r.height) };
  }

  measureText = (text: string, font: string): number => {
    if (!this.measureCtx) return text.length * 7;
    this.measureCtx.font = font;
    return this.measureCtx.measureText(text).width;
  };

  setCursor(cursor: string): void {
    if (this.root.style.cursor !== cursor) this.root.style.cursor = cursor;
  }

  destroy(): void {
    this.observer.disconnect();
    for (const s of Object.values(this.surfaces)) s.destroy();
    this.root.remove();
  }
}
