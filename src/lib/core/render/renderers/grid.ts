import type { LayerRenderer } from '../frame';
import { crisp } from '../draw-utils';

export const gridRenderer: LayerRenderer = {
  id: 'core.grid',
  zIndex: 10,
  render(ctx, f) {
    const { plot, pricePane, volumePane } = f.layout;
    ctx.strokeStyle = f.theme.colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (f.options.gridVertical) {
      for (const t of f.timeTicks) {
        const x = crisp(t.x, f.dpr);
        ctx.moveTo(x, plot.y);
        ctx.lineTo(x, plot.y + plot.height);
      }
    }
    if (f.options.gridHorizontal) {
      for (const t of f.priceTicks) {
        if (t.y < pricePane.y || t.y > pricePane.y + pricePane.height) continue;
        const y = crisp(t.y, f.dpr);
        ctx.moveTo(plot.x, y);
        ctx.lineTo(plot.x + plot.width, y);
      }
    }
    ctx.stroke();
    if (volumePane) {
      ctx.strokeStyle = f.theme.colors.scaleBorder;
      ctx.beginPath();
      const y = crisp(volumePane.y, f.dpr);
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
    }
  },
};
