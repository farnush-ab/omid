import { ENGINE_CONFIG } from '../../config';
import { formatCompact, formatDateTime } from '../../util/format';
import { applyLineStyle, crisp, drawLabel } from '../draw-utils';
import type { LayerRenderer } from '../frame';

const DOT_RADIUS = 3;

/** Crosshair lines (full / dot / arrow) plus price and time labels on the axes. */
export const crosshairRenderer: LayerRenderer = {
  id: 'core.crosshair',
  zIndex: 100,
  render(ctx, f) {
    const ch = f.crosshair;
    if (!ch) return;
    const { plot, priceAxis, timeAxis, volumeAxis, volumePane } = f.layout;
    const c = f.theme.colors;
    const x = f.timeScale.indexToX(Math.round(ch.index));
    const mode = f.options.crosshairMode;
    if (mode === 'full') {
      applyLineStyle(ctx, c.crosshair, 1, f.options.crosshairLineStyle);
      const xx = crisp(x, f.dpr);
      const yy = crisp(ch.y, f.dpr);
      ctx.beginPath();
      ctx.moveTo(xx, plot.y);
      ctx.lineTo(xx, plot.y + plot.height);
      ctx.moveTo(plot.x, yy);
      ctx.lineTo(plot.x + plot.width, yy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (mode === 'dot') {
      ctx.fillStyle = c.crosshair;
      ctx.beginPath();
      ctx.arc(x, ch.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    const label = { bg: c.crosshairLabelBg, fg: c.crosshairLabelText, font: f.font };
    if (ch.region === 'price-pane') {
      drawLabel(ctx, f.formatPrice(ch.price), priceAxis.x + 1, ch.y, label);
    } else if (volumeAxis && volumePane) {
      const vol =
        ((volumePane.y + volumePane.height - ch.y) /
          (volumePane.height * ENGINE_CONFIG.volume.headroom)) *
        f.volumeMax;
      drawLabel(ctx, formatCompact(Math.max(0, vol), 2), volumeAxis.x + 1, ch.y, label);
    }
    const text = formatDateTime(
      f.coords.indexToTime(Math.round(ch.index)),
      f.timeframe.dateOnly,
      !f.timeframe.dateOnly,
    );
    ctx.font = f.font;
    const w = ctx.measureText(text).width + 16;
    const cx = Math.max(w / 2, Math.min(timeAxis.width - w / 2, x));
    drawLabel(ctx, text, cx, timeAxis.y + timeAxis.height / 2, {
      ...label,
      align: 'center',
      height: timeAxis.height - 6,
    });
  },
};
