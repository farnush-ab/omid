import type { FrameState, LayerRenderer } from './frame';
import { LAYERS, LayerMask, type LayerId } from './layers';
import type { Surface } from './surface';

/** Owns one surface per layer and the renderers registered on each. */
export class LayerManager {
  private renderers = new Map<LayerId, LayerRenderer[]>(LAYERS.map((id) => [id, []]));

  constructor(private readonly surfaces: Readonly<Record<LayerId, Surface>>) {}

  add(layer: LayerId, renderer: LayerRenderer): () => void {
    const list = this.renderers.get(layer)!;
    list.push(renderer);
    list.sort((a, b) => a.zIndex - b.zIndex);
    return () => {
      const i = list.indexOf(renderer);
      if (i >= 0) list.splice(i, 1);
    };
  }

  resize(width: number, height: number, dpr: number): void {
    for (const id of LAYERS) this.surfaces[id].resize(width, height, dpr);
  }

  /** Redraws the layers whose bit is set in `mask`. */
  render(mask: number, frame: FrameState): void {
    for (const id of LAYERS) {
      if (!(mask & LayerMask[id])) continue;
      const surface = this.surfaces[id];
      surface.begin();
      for (const r of this.renderers.get(id)!) {
        surface.ctx.save();
        r.render(surface.ctx, frame);
        surface.ctx.restore();
      }
    }
  }

  destroy(): void {
    for (const id of LAYERS) this.surfaces[id].destroy();
  }
}
