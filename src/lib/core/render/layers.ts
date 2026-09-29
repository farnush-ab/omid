/** Fixed canvas stack, bottom to top. Plugins add renderers to these layers. */
export const LAYERS = ['background', 'series', 'drawings', 'axes', 'overlay'] as const;
export type LayerId = (typeof LAYERS)[number];

export const LayerMask: Readonly<Record<LayerId, number>> = {
  background: 1,
  series: 2,
  drawings: 4,
  axes: 8,
  overlay: 16,
};

export const ALL_LAYERS = 31;
/** What typically needs redrawing when the viewport moves. */
export const VIEWPORT_LAYERS = ALL_LAYERS;

export const maskOf = (...ids: LayerId[]): number => ids.reduce((m, id) => m | LayerMask[id], 0);
