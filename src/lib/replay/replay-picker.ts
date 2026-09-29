import {
  LayerMask,
  crisp,
  withOpacity,
  type ChartEngine,
  type ChartPointerEvent,
  type InteractionHandler,
  type LayerRenderer,
} from '@/lib/core';

/** Scissors cursor (TradingView's "cut" cursor while choosing the replay start). */
const SCISSORS_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
)}") 12 12, crosshair`;

/**
 * While selecting, a vertical cut line follows the pointer (bars to its right will be
 * hidden) and a click picks the start bar. Inactive otherwise.
 */
export class ReplayPicker implements InteractionHandler {
  readonly id = 'replay-picker';
  readonly priority = 100;
  private hoverIndex: number | null = null;
  active = false;

  constructor(
    private readonly engine: ChartEngine,
    private readonly onPick: (barIndex: number) => void,
  ) {}

  private barAt(e: ChartPointerEvent): number {
    const n = this.engine.seriesData.length;
    return Math.max(0, Math.min(n - 1, Math.round(e.index)));
  }

  setActive(active: boolean): void {
    this.active = active;
    this.hoverIndex = null;
    this.engine.invalidate(LayerMask.overlay);
  }

  onHover(e: ChartPointerEvent): string | null {
    if (!this.active) return null;
    this.hoverIndex = this.barAt(e);
    this.engine.invalidate(LayerMask.overlay);
    return SCISSORS_CURSOR;
  }

  onPointerLeave(): void {
    if (!this.active) return;
    this.hoverIndex = null;
    this.engine.invalidate(LayerMask.overlay);
  }

  onPointerDown(e: ChartPointerEvent): boolean {
    if (!this.active) return false;
    this.onPick(this.barAt(e));
    return true;
  }

  readonly renderer: LayerRenderer = {
    id: 'replay-picker',
    zIndex: 90,
    render: (ctx, f) => {
      if (!this.active || this.hoverIndex === null) return;
      const x = f.timeScale.indexToX(this.hoverIndex);
      const { plot } = f.layout;
      const accent = f.theme.colors.uiAccent;
      ctx.fillStyle = withOpacity(f.theme.colors.background, 0.55);
      ctx.fillRect(x + f.timeScale.barSpacing / 2, plot.y, plot.x + plot.width - x, plot.height);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crisp(x + f.timeScale.barSpacing / 2, f.dpr, 2), plot.y);
      ctx.lineTo(crisp(x + f.timeScale.barSpacing / 2, f.dpr, 2), plot.y + plot.height);
      ctx.stroke();
    },
  };
}
