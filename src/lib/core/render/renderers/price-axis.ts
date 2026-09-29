import { ENGINE_CONFIG } from '../../config';
import { contrastText } from '../../util/color';
import { formatCompact } from '../../util/format';
import type { FrameState, LayerRenderer } from '../frame';
import { drawLabel, vLine } from '../draw-utils';

const PAD = ENGINE_CONFIG.priceAxis.padding;

/** Price axis (and volume axis) with tick labels, last-price and prev-close labels. */
export const priceAxisRenderer: LayerRenderer = {
  id: 'core.price-axis',
  zIndex: 0,
  render(ctx, f) {
    const { priceAxis, volumeAxis } = f.layout;
    const c = f.theme.colors;
    ctx.fillStyle = c.background;
    ctx.fillRect(priceAxis.x, 0, priceAxis.width, f.height);
    ctx.strokeStyle = c.scaleBorder;
    ctx.lineWidth = 1;
    vLine(ctx, priceAxis.x, 0, f.layout.plot.height, f.dpr);

    ctx.font = f.font;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const pane = f.layout.pricePane;
    for (const t of f.priceTicks) {
      if (t.y < pane.y + 6 || t.y > pane.y + pane.height - 6) continue;
      ctx.fillText(t.label, priceAxis.x + PAD, t.y);
    }
    if (volumeAxis && f.layout.volumePane) {
      ctx.strokeStyle = c.scaleBorder;
      ctx.beginPath();
      ctx.moveTo(volumeAxis.x, volumeAxis.y + 0.5);
      ctx.lineTo(volumeAxis.x + volumeAxis.width, volumeAxis.y + 0.5);
      ctx.stroke();
      ctx.fillStyle = c.text;
      for (const t of f.volumeTicks) {
        if (t.y < volumeAxis.y + 8 || t.y > volumeAxis.y + volumeAxis.height - 4) continue;
        ctx.fillText(formatCompact(t.price, 1), volumeAxis.x + PAD, t.y);
      }
    }
    drawValueLabels(ctx, f);
  },
};

function drawValueLabels(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const last = f.series.lastIndex;
  if (last < 0) return;
  const x = f.layout.priceAxis.x;
  const pane = f.layout.pricePane;
  const inPane = (y: number) => y >= pane.y && y <= pane.y + pane.height;
  if (f.options.showPrevCloseLine && f.prevClose !== null) {
    const y = f.priceScale.priceToY(f.prevClose);
    if (inPane(y)) {
      const bg = f.theme.colors.prevCloseLine;
      drawLabel(ctx, f.formatPrice(f.prevClose), x + 1, y, {
        bg,
        fg: contrastText(bg),
        font: f.font,
      });
    }
  }
  if (f.options.showLastPriceLabel) {
    const close = f.series.close[last]!;
    const y = f.priceScale.priceToY(close);
    if (inPane(y)) {
      const bg = close >= f.series.open[last]! ? f.theme.colors.upBody : f.theme.colors.downBody;
      drawLabel(ctx, f.formatPrice(close), x + 1, y, { bg, fg: contrastText(bg), font: f.font });
    }
  }
}
