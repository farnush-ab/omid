import type { DrawingContext } from './types';

export type MagnetMode = 'off' | 'weak' | 'strong';

/** Weak magnet only snaps within this distance (px). */
export const WEAK_MAGNET_PX = 14;

/**
 * Snaps a price to the nearest open/high/low/close of the bar at `index`.
 * Strong always snaps; weak only when the cursor is close to one of them.
 */
export function snapPrice(
  index: number,
  price: number,
  mode: MagnetMode,
  dc: DrawingContext,
): number {
  if (mode === 'off') return price;
  const i = Math.round(index);
  const d = dc.data;
  if (i < 0 || i >= d.length) return price;
  const y = dc.coords.priceToY(price);
  let best = price;
  let bestDist = Infinity;
  for (const v of [d.open[i]!, d.high[i]!, d.low[i]!, d.close[i]!]) {
    const dist = Math.abs(dc.coords.priceToY(v) - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return mode === 'strong' || bestDist <= WEAK_MAGNET_PX ? best : price;
}
