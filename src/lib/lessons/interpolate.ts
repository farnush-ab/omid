/** Linear interpolation of flat numeric records; non-numeric keys take the earlier value. */
export function lerpRecord(a: unknown, b: unknown, alpha: number): unknown {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return a;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, va] of Object.entries(ra)) {
    const vb = rb[k];
    out[k] = typeof va === 'number' && typeof vb === 'number' ? va + (vb - va) * alpha : va;
  }
  return out;
}
