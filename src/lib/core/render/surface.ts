/** A canvas plus its 2D context, sized for the device pixel ratio. */
export interface Surface {
  readonly ctx: CanvasRenderingContext2D;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Resets the transform to CSS pixels and clears. */
  begin(): void;
  destroy(): void;
}

export class CanvasSurface implements Surface {
  readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.w = cssWidth;
    this.h = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  begin(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  destroy(): void {
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.remove();
  }
}
