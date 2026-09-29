import { z } from 'zod';
import type { DrawingRegistry } from './registry';
import type { Drawing, DrawingStyle, SerializedDrawing } from './types';

const finite = z.number().refine(Number.isFinite, 'must be finite');

export const serializedDrawingSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  points: z.array(z.object({ time: finite, price: finite })).max(10_000),
  style: z.record(z.string(), z.unknown()),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

export type DeserializeResult =
  { readonly ok: true; readonly drawing: Drawing } | { readonly ok: false; readonly error: string };

/**
 * Validates untrusted data (storage, imports, clipboard) and rebuilds the drawing through its
 * registered factory. Missing style keys come from defaults; unknown keys are dropped.
 */
export function deserializeDrawing(raw: unknown, registry: DrawingRegistry): DeserializeResult {
  const base = serializedDrawingSchema.safeParse(raw);
  if (!base.success) return { ok: false, error: 'malformed drawing' };
  const def = registry.get(base.data.type);
  if (!def) return { ok: false, error: `unknown drawing type "${base.data.type}"` };
  const merged: DrawingStyle = { ...def.defaults };
  for (const key of Object.keys(def.defaults)) {
    if (key in base.data.style) merged[key] = base.data.style[key];
  }
  const style = def.styleSchema.safeParse(merged);
  if (!style.success) return { ok: false, error: `invalid style for "${def.id}"` };
  const drawing = def.create({
    id: base.data.id,
    points: base.data.points,
    style: style.data,
    locked: base.data.locked,
    hidden: base.data.hidden,
  });
  return { ok: true, drawing };
}

export function deserializeMany(
  raws: readonly unknown[],
  registry: DrawingRegistry,
): { drawings: Drawing[]; skipped: string[] } {
  const drawings: Drawing[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    const r = deserializeDrawing(raw, registry);
    if (r.ok && !seen.has(r.drawing.id)) {
      seen.add(r.drawing.id);
      drawings.push(r.drawing);
    } else skipped.push(r.ok ? `duplicate id ${r.drawing.id}` : r.error);
  }
  return { drawings, skipped };
}

export const cloneSerialized = <S extends DrawingStyle>(
  s: SerializedDrawing<S>,
): SerializedDrawing<S> => structuredClone(s) as SerializedDrawing<S>;
