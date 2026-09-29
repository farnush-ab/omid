import { ENGINE_CONFIG } from '../../config';
import type { FrameState, LayerRenderer } from '../frame';

const VOLUME_HEADROOM = ENGINE_CONFIG.volume.headroom;

/** Volume histogram in its own pane. Draws in device pixels for crisp bars. */
export const volumeRenderer: LayerRenderer = {
  id: 'core.volume',
  zIndex: 5,
  render(ctx, f) {
    const pane = f.layout.volumePane;
    if (!pane || f.volumeMax <= 0 || f.series.length === 0) return;
    const { dpr } = f;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x * dpr, pane.y * dpr, pane.width * dpr, pane.height * dpr);
    ctx.clip();
    const bottom = Math.round((pane.y + pane.height) * dpr);
    const scale = (pane.height * VOLUME_HEADROOM * dpr) / f.volumeMax;
    if (f.timeScale.barSpacing < ENGINE_CONFIG.lodBarSpacing)
      renderDecimated(ctx, f, bottom, scale);
    else renderBars(ctx, f, bottom, scale);
    ctx.restore();
  },
};

function renderBars(
  ctx: CanvasRenderingContext2D,
  f: FrameState,
  bottom: number,
  scale: number,
): void {
  const { open, close, volume } = f.series;
  const width = Math.max(
    1,
    Math.floor(f.timeScale.barSpacing * f.dpr * ENGINE_CONFIG.candleBodyRatio),
  );
  const half = Math.floor(width / 2);
  for (const up of [true, false]) {
    ctx.fillStyle = up ? f.theme.colors.volumeUp : f.theme.colors.volumeDown;
    for (let i = f.visible.from; i <= f.visible.to; i++) {
      if (close[i]! >= open[i]! !== up) continue;
      const x = Math.round(f.timeScale.indexToX(i) * f.dpr);
      const h = Math.max(1, Math.round(volume[i]! * scale));
      ctx.fillRect(x - half, bottom - h, width, h);
    }
  }
}

/** One column per device pixel: max volume, coloured by the column's net direction. */
function renderDecimated(
  ctx: CanvasRenderingContext2D,
  f: FrameState,
  bottom: number,
  scale: number,
): void {
  const { open, close, volume } = f.series;
  const { from, to } = f.visible;
  const x0 = f.timeScale.indexToX(from) * f.dpr;
  const dx = f.timeScale.barSpacing * f.dpr;
  const up: number[] = [];
  const down: number[] = [];
  let col = -1;
  let max = 0;
  let net = 0;
  const flush = () => {
    if (col >= 0 && max > 0) (net >= 0 ? up : down).push(col, Math.max(1, Math.round(max * scale)));
  };
  for (let i = from; i <= to; i++) {
    const x = Math.round(x0 + (i - from) * dx);
    if (x !== col) {
      flush();
      col = x;
      max = 0;
      net = 0;
    }
    const v = volume[i]!;
    if (v > max) max = v;
    net += close[i]! >= open[i]! ? v : -v;
  }
  flush();
  for (const [color, cols] of [
    [f.theme.colors.volumeUp, up],
    [f.theme.colors.volumeDown, down],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < cols.length; k += 2)
      ctx.rect(cols[k]!, bottom - cols[k + 1]!, 1, cols[k + 1]!);
    ctx.fill();
  }
}
