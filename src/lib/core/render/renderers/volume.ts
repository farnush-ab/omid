import { ENGINE_CONFIG } from '../../config';
import type { LayerRenderer } from '../frame';

const VOLUME_HEADROOM = ENGINE_CONFIG.volume.headroom;

/** Volume histogram in its own pane. Draws in device pixels for crisp bars. */
export const volumeRenderer: LayerRenderer = {
  id: 'core.volume',
  zIndex: 5,
  render(ctx, f) {
    const pane = f.layout.volumePane;
    if (!pane || f.volumeMax <= 0 || f.series.length === 0) return;
    const { dpr, series, timeScale } = f;
    const { open, close, volume } = series;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x * dpr, pane.y * dpr, pane.width * dpr, pane.height * dpr);
    ctx.clip();
    const bottom = Math.round((pane.y + pane.height) * dpr);
    const scale = (pane.height * VOLUME_HEADROOM * dpr) / f.volumeMax;
    const bs = timeScale.barSpacing;
    const lod = bs < ENGINE_CONFIG.lodBarSpacing;
    const width = lod ? 1 : Math.max(1, Math.floor(bs * dpr * ENGINE_CONFIG.candleBodyRatio));
    const half = Math.floor(width / 2);
    for (const up of [true, false]) {
      ctx.fillStyle = up ? f.theme.colors.volumeUp : f.theme.colors.volumeDown;
      let lastCol = -1;
      let colMax = 0;
      const flush = () => {
        if (lastCol >= 0 && colMax > 0) {
          const h = Math.max(1, Math.round(colMax * scale));
          ctx.fillRect(lastCol, bottom - h, 1, h);
        }
      };
      for (let i = f.visible.from; i <= f.visible.to; i++) {
        if (close[i]! >= open[i]! !== up) continue;
        const x = Math.round(timeScale.indexToX(i) * dpr);
        const v = volume[i]!;
        if (lod) {
          if (x !== lastCol) {
            flush();
            lastCol = x;
            colMax = 0;
          }
          if (v > colMax) colMax = v;
        } else {
          const h = Math.max(1, Math.round(v * scale));
          ctx.fillRect(x - half, bottom - h, width, h);
        }
      }
      if (lod) flush();
    }
    ctx.restore();
  },
};
