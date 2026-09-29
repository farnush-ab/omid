import type { Rng } from '../contracts/runtime';

/** mulberry32 — tiny, fast, deterministic. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}

/** Stateless 32-bit hash of a list of integers -> [0, 1). Used for random-access noise. */
export function hash01(...values: number[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    const lo = v | 0;
    const hi = Math.floor(v / 4294967296) | 0;
    h = Math.imul(h ^ lo, 0x01000193);
    h = Math.imul(h ^ hi, 0x01000193);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Deterministic string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
