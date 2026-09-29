import type { FrameState, LayerRenderer } from '../frame';
import { fontString } from '../draw-utils';

export const backgroundRenderer: LayerRenderer = {
  id: 'core.background',
  zIndex: 0,
  render(ctx, f) {
    const { colors } = f.theme;
    if (f.options.backgroundType === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, 0, f.height);
      g.addColorStop(0, colors.background);
      g.addColorStop(1, colors.backgroundGradientEnd);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = colors.background;
    }
    ctx.fillRect(0, 0, f.width, f.height);
    if (f.options.watermarkVisible) drawWatermark(ctx, f);
  },
};

function drawWatermark(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const text = f.options.watermarkText.trim() || `${f.symbol.symbol}, ${f.timeframe.label}`;
  const pane = f.layout.pricePane;
  const size = Math.max(18, Math.min(72, (pane.width / Math.max(6, text.length)) * 1.2));
  ctx.font = fontString(size, undefined, true);
  ctx.fillStyle = f.theme.colors.watermark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pane.x + pane.width / 2, pane.y + pane.height / 2);
}
