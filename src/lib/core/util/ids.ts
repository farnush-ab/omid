import type { Rng } from '../contracts/runtime';

export type IdGenerator = () => string;

/** Collision-resistant ids from an injected RNG (deterministic in tests). */
export function createIdGenerator(rng: Rng, prefix = ''): IdGenerator {
  let counter = 0;
  return () => {
    counter += 1;
    const rand = Math.floor(rng.next() * 0xffffffff)
      .toString(36)
      .padStart(7, '0');
    return `${prefix}${rand}${counter.toString(36)}`;
  };
}
