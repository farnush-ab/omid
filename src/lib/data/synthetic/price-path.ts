import { DAY_MS, HOUR_MS, MINUTE_MS, hash01 } from '@/lib/core';

/** Periods (ms) of the noise octaves that make up the synthetic price path. */
const OCTAVES = [
  365 * DAY_MS,
  90 * DAY_MS,
  30 * DAY_MS,
  7 * DAY_MS,
  DAY_MS,
  4 * HOUR_MS,
  HOUR_MS,
  15 * MINUTE_MS,
  3 * MINUTE_MS,
];
const DAILY_VOL = 0.028;

const amplitude = (periodMs: number): number => DAILY_VOL * Math.sqrt(periodMs / DAY_MS);

/** Smooth 1-D value noise in [-1, 1]. */
function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(seed, i) * 2 - 1;
  const b = hash01(seed, i + 1) * 2 - 1;
  const t = (1 - Math.cos(f * Math.PI)) / 2;
  return a + (b - a) * t;
}

/**
 * Deterministic, random-access price function: the same (seed, time) always yields the same
 * price, so any window of history can be generated independently and pages line up.
 */
export function pricePath(time: number, seed: number, refPrice: number): number {
  let sum = 0;
  for (let o = 0; o < OCTAVES.length; o++) {
    const period = OCTAVES[o]!;
    sum += amplitude(period) * valueNoise(time / period, seed + o * 7919);
  }
  return refPrice * Math.exp(sum);
}

/** Small per-bar noise in [0, 1) used for wicks and volume. */
export const barNoise = (seed: number, time: number, salt: number): number =>
  hash01(seed, salt, time);

export const wickAmplitude = amplitude;
