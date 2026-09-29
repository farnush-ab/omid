import { WEIGHT } from '../../scales/time-ticks';
import { fontString, hLine } from '../draw-utils';
import type { LayerRenderer } from '../frame';

export const timeAxisRenderer: LayerRenderer = {
  id: 'core.time-axis',
  zIndex: 0,
  render(ctx, f) {
    const { timeAxis } = f.layout;
    const c = f.theme.colors;
    ctx.fillStyle = c.background;
    ctx.fillRect(0, timeAxis.y, f.width, timeAxis.height);
    ctx.strokeStyle = c.scaleBorder;
    ctx.lineWidth = 1;
    hLine(ctx, timeAxis.y, 0, f.width, f.dpr);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.text;
    const normal = f.font;
    const bold = fontString(f.options.fontSize, undefined, true);
    const cy = timeAxis.y + timeAxis.height / 2;
    for (const t of f.timeTicks) {
      if (t.x < 0 || t.x > timeAxis.width) continue;
      ctx.font = t.weight >= WEIGHT.month ? bold : normal;
      ctx.fillText(t.label, t.x, cy);
    }
  },
};
