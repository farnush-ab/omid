import { z } from 'zod';
import { LESSON_TIMELINE_VERSION, type LessonTimeline } from './types';

const finite = z.number().refine(Number.isFinite, 'must be finite');

const symbolSchema = z.object({
  symbol: z.string(),
  description: z.string(),
  tickSize: finite,
  pricePrecision: finite,
  qtyStep: finite,
  quoteCurrency: z.string(),
  baseCurrency: z.string(),
});

const column = z.array(finite);

export const lessonTimelineSchema = z.object({
  version: z.number().int().min(1).max(LESSON_TIMELINE_VERSION),
  duration: finite.min(0),
  initial: z.record(z.string(), z.unknown()),
  ops: z.array(
    z.object({
      t: finite.min(0),
      s: z.string().min(1),
      v: z.unknown(),
      p: z.literal(1).optional(),
    }),
  ),
  datasets: z.array(
    z.object({
      key: z.string(),
      symbol: symbolSchema,
      timeframe: z.string(),
      columns: z.tuple([column, column, column, column, column, column]),
    }),
  ),
});

export class LessonFormatError extends Error {}

/** Validates untrusted timeline data (storage, imported files). */
export function parseTimeline(raw: unknown): LessonTimeline {
  const res = lessonTimelineSchema.safeParse(raw);
  if (!res.success) throw new LessonFormatError(`Invalid lesson timeline: ${res.error.message}`);
  const data = res.data as LessonTimeline;
  for (let i = 1; i < data.ops.length; i++) {
    if (data.ops[i]!.t < data.ops[i - 1]!.t) throw new LessonFormatError('Lesson ops out of order');
  }
  return data;
}

const GZIP_MAGIC = [0x1f, 0x8b];

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Response(
    new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(stream as TransformStream<Uint8Array, Uint8Array>),
  );
  return new Uint8Array(await out.arrayBuffer());
}

/** JSON + gzip when the platform supports CompressionStream (all current browsers, Node 18+). */
export async function encodeTimeline(timeline: LessonTimeline): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(timeline));
  if (typeof CompressionStream === 'undefined') return json;
  return pipe(json, new CompressionStream('gzip'));
}

export async function decodeTimeline(bytes: Uint8Array): Promise<LessonTimeline> {
  let raw = bytes;
  if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
    if (typeof DecompressionStream === 'undefined')
      throw new LessonFormatError('This browser cannot decompress lessons');
    raw = await pipe(bytes, new DecompressionStream('gzip'));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new LessonFormatError('Lesson timeline is not valid JSON');
  }
  return parseTimeline(parsed);
}

/** Rounds to `digits` significant digits (keeps timelines small, values stay exact enough). */
export function roundSig(value: number, digits = 8): number {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number(value.toPrecision(digits));
}
