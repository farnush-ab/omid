import { ENGINE_CONFIG, type FrameState } from '@/lib/core';

/**
 * Draws candles in device pixels. Above the LOD threshold every visible bar gets a wick,
 * body and border; below it bars are decimated per pixel column (one high-low stroke per
 * column and colour) so 50k+ candles stay cheap.
 */
export function renderCandles(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const { series, timeScale, priceScale, dpr, options, theme, visible } = f;
  if (series.length === 0) return;
  const pane = f.layout.pricePane;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(pane.x * dpr, pane.y * dpr, pane.width * dpr, pane.height * dpr);
  ctx.clip();
  const toY = (p: number) => priceScale.priceToY(p) * dpr;
  const c = theme.colors;
  if (timeScale.barSpacing < ENGINE_CONFIG.lodBarSpacing) {
    renderDecimated(ctx, f, toY);
    return;
  }
  const { open, high, low, close } = series;
  const bodyW = Math.max(1, Math.floor(timeScale.barSpacing * dpr * ENGINE_CONFIG.candleBodyRatio));
  const bodyWOdd = bodyW % 2 === 0 && bodyW > 2 ? bodyW - 1 : bodyW;
  const half = Math.floor(bodyWOdd / 2);
  const wickW = Math.max(1, Math.floor(dpr));
  const wickHalf = Math.floor(wickW / 2);
  const drawBorders = options.showBorders && bodyWOdd > 2;

  for (const up of [true, false]) {
    if (options.showWicks) {
      ctx.fillStyle = up ? c.upWick : c.downWick;
      for (let i = visible.from; i <= visible.to; i++) {
        if (close[i]! >= open[i]! !== up) continue;
        const x = Math.round(timeScale.indexToX(i) * dpr);
        const yh = Math.round(toY(high[i]!));
        const yl = Math.round(toY(low[i]!));
        ctx.fillRect(x - wickHalf, Math.min(yh, yl), wickW, Math.max(1, Math.abs(yl - yh)));
      }
    }
    if (options.showBody || drawBorders) {
      for (let i = visible.from; i <= visible.to; i++) {
        if (close[i]! >= open[i]! !== up) continue;
        const x = Math.round(timeScale.indexToX(i) * dpr);
        const yo = Math.round(toY(open[i]!));
        const yc = Math.round(toY(close[i]!));
        const top = Math.min(yo, yc);
        const h = Math.max(1, Math.abs(yc - yo));
        if (drawBorders) {
          ctx.fillStyle = up ? c.upBorder : c.downBorder;
          ctx.fillRect(x - half, top, bodyWOdd, h);
          if (options.showBody && h > 2) {
            ctx.fillStyle = up ? c.upBody : c.downBody;
            ctx.fillRect(x - half + 1, top + 1, bodyWOdd - 2, h - 2);
          } else if (!options.showBody && h > 2) {
            ctx.clearRect(x - half + 1, top + 1, bodyWOdd - 2, h - 2);
          }
        } else if (options.showBody) {
          ctx.fillStyle = up ? c.upBody : c.downBody;
          ctx.fillRect(x - half, top, bodyWOdd, h);
        }
      }
    }
  }
}

function renderDecimated(
  ctx: CanvasRenderingContext2D,
  f: FrameState,
  toY: (p: number) => number,
): void {
  const { series, timeScale, dpr, visible, theme } = f;
  const { open, high, low, close } = series;
  let col = -1;
  let hi = -Infinity;
  let lo = Infinity;
  let first = 0;
  let last = 0;
  const cols: { up: number[]; down: number[] } = { up: [], down: [] };
  const flush = () => {
    if (col < 0) return;
    const bucket = close[last]! >= open[first]! ? cols.up : cols.down;
    bucket.push(col, Math.round(toY(hi)), Math.round(toY(lo)));
  };
  for (let i = visible.from; i <= visible.to; i++) {
    const x = Math.round(timeScale.indexToX(i) * dpr);
    if (x !== col) {
      flush();
      col = x;
      hi = high[i]!;
      lo = low[i]!;
      first = i;
    } else {
      if (high[i]! > hi) hi = high[i]!;
      if (low[i]! < lo) lo = low[i]!;
    }
    last = i;
  }
  flush();
  const w = Math.max(1, Math.floor(dpr));
  for (const [color, arr] of [
    [theme.colors.upBody, cols.up],
    [theme.colors.downBody, cols.down],
  ] as const) {
    ctx.fillStyle = color;
    for (let k = 0; k < arr.length; k += 3) {
      const yh = arr[k + 1]!;
      const yl = arr[k + 2]!;
      ctx.fillRect(arr[k]!, Math.min(yh, yl), w, Math.max(1, Math.abs(yl - yh)));
    }
  }
}
