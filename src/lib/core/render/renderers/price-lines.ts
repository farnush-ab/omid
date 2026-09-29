import type { LayerRenderer } from '../frame';
import { applyLineStyle, hLine } from '../draw-utils';

/** Last-price and previous-close lines across the price pane. */
export const priceLinesRenderer: LayerRenderer = {
  id: 'core.price-lines',
  zIndex: 30,
  render(ctx, f) {
    const last = f.series.lastIndex;
    if (last < 0) return;
    const pane = f.layout.pricePane;
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();
    if (f.options.showLastPriceLine) {
      const up = f.series.close[last]! >= f.series.open[last]!;
      applyLineStyle(ctx, up ? f.theme.colors.upBody : f.theme.colors.downBody, 1, 'dotted');
      hLine(ctx, f.priceScale.priceToY(f.series.close[last]!), pane.x, pane.x + pane.width, f.dpr);
    }
    if (f.options.showPrevCloseLine && f.prevClose !== null) {
      applyLineStyle(ctx, f.theme.colors.prevCloseLine, 1, 'dashed');
      hLine(ctx, f.priceScale.priceToY(f.prevClose), pane.x, pane.x + pane.width, f.dpr);
    }
  },
};
