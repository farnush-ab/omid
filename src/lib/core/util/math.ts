export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Round to a multiple of `step` (e.g. tick size), robust against float noise. */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const decimals = decimalsOf(step);
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

export function floorToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const decimals = decimalsOf(step);
  return Number((Math.floor(value / step + 1e-9) * step).toFixed(decimals));
}

/** Number of decimals needed to display `step` exactly (0.001 -> 3, 5 -> 0). */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = step.toString();
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}
