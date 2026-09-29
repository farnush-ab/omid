import type { PriceScale } from './price-scale';

export interface PriceTick {
  readonly y: number;
  readonly price: number;
  readonly label: string;
}

const NICE = [1, 2, 2.5, 5, 10];

/** Smallest "nice" number (1, 2, 2.5, 5 × 10^k) >= raw. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  for (const n of NICE) if (n * base >= raw - 1e-12 * base) return n * base;
  return 10 * base;
}

function linearTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start, i = 0; v <= max + step * 1e-9 && i < 500; v = start + ++i * step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/** Price ticks for the visible range of `scale`, at least `minSpacingPx` apart. */
export function generatePriceTicks(
  scale: PriceScale,
  minSpacingPx: number,
  formatPrice: (price: number) => string,
): PriceTick[] {
  const lo = Math.min(scale.min, scale.max);
  const hi = Math.max(scale.min, scale.max);
  const logicalStep = scale.unitsPerPixel * minSpacingPx;

  if (scale.mode === 'linear' || scale.mode === 'percent') {
    const step = niceStep(logicalStep);
    return linearTicks(lo, hi, step).map((l) => {
      const price = scale.fromLogical(l);
      const label =
        scale.mode === 'percent'
          ? `${l > 0 ? '+' : ''}${l.toFixed(step < 1 ? 2 : 0)}%`
          : formatPrice(price);
      return { y: scale.logicalToY(l), price, label };
    });
  }

  // Log mode: walk upwards in price space with a locally nice step.
  const out: PriceTick[] = [];
  let price = scale.fromLogical(lo);
  const top = scale.fromLogical(hi);
  const growth = Math.exp(logicalStep) - 1;
  for (let i = 0; i < 200 && price <= top; i++) {
    const step = niceStep(Math.max(price * growth, Number.EPSILON));
    const tick = Math.ceil(price / step - 1e-9) * step;
    if (tick > top) break;
    const last = out[out.length - 1];
    if (!last || tick > last.price)
      out.push({ y: scale.priceToY(tick), price: tick, label: formatPrice(tick) });
    price = tick + step;
  }
  return out;
}
