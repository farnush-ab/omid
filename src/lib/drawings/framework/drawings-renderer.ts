import { ENGINE_CONFIG, rectsIntersect, type FrameState, type LayerRenderer } from '@/lib/core';
import type { DrawingManager } from './drawing-manager';
import type { DrawingInteraction } from './interaction/drawing-interaction';
import type { Drawing, DrawingContext } from './types';

const { radius: HANDLE_R } = ENGINE_CONFIG.handles;

function contextFromFrame(f: FrameState, m: DrawingManager): DrawingContext {
  return {
    coords: f.coords,
    data: f.series,
    symbol: f.symbol,
    timeframe: f.timeframe,
    theme: f.theme,
    pane: f.layout.pricePane,
    dpr: f.dpr,
    formatPrice: f.formatPrice,
    measureText: (t, font) => m.engine.measureText(t, font),
  };
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  dc: DrawingContext,
  activeAnchor: number | null,
  faint: boolean,
): void {
  const c = dc.theme.colors;
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  for (const a of d.getAnchors(dc)) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.index === activeAnchor ? HANDLE_R + 1 : HANDLE_R, 0, Math.PI * 2);
    ctx.globalAlpha = faint ? 0.6 : 1;
    ctx.fillStyle = a.index === activeAnchor ? c.selection : c.drawingHandle;
    ctx.fill();
    ctx.strokeStyle = c.selection;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Renders every visible drawing (culled), the placement preview and selection handles. */
export function createDrawingsRenderer(
  m: DrawingManager,
  interaction: DrawingInteraction,
): LayerRenderer {
  return {
    id: 'drawings',
    zIndex: 0,
    render(ctx, f) {
      const preview = interaction.placement?.drawing ?? m.placementGhost;
      if (m.modes.hideAll && !preview) return;
      const dc = contextFromFrame(f, m);
      const pane = f.layout.pricePane;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.x, pane.y, pane.width, pane.height);
      ctx.clip();
      const selected = m.selected;
      const hover = interaction.hover;
      if (!m.modes.hideAll) {
        for (const d of m.store.all()) {
          if (d.hidden) continue;
          const b = d.bounds(dc);
          if (b && !rectsIntersect(b, pane)) continue;
          ctx.save();
          d.render(ctx, dc, {
            hovered: hover.id === d.id,
            selected: selected === d,
            placing: false,
          });
          ctx.restore();
        }
      }
      if (preview) {
        ctx.save();
        preview.render(ctx, dc, { hovered: false, selected: true, placing: true });
        ctx.restore();
        drawHandles(ctx, preview, dc, null, false);
      }
      if (selected && !selected.hidden && !m.modes.hideAll) {
        drawHandles(ctx, selected, dc, hover.id === selected.id ? hover.anchor : null, false);
      } else if (hover.id && !m.modes.hideAll) {
        const d = m.store.get(hover.id);
        if (d && !d.hidden) drawHandles(ctx, d, dc, hover.anchor, true);
      }
      ctx.restore();
    },
  };
}
