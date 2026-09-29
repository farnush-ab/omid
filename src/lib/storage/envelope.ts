import { z } from 'zod';

/** Kinds of persisted records. Each has its own version line and migrations. */
export const RECORD_KINDS = [
  'drawings',
  'themes',
  'chartSettings',
  'toolDefaults',
  'appState',
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** Current schema version per kind. Bump together with a migration in ./migrations. */
export const CURRENT_VERSION: Readonly<Record<RecordKind, number>> = {
  drawings: 2,
  themes: 1,
  chartSettings: 1,
  toolDefaults: 1,
  appState: 1,
};

export interface Envelope<T = unknown> {
  readonly kind: RecordKind;
  readonly schemaVersion: number;
  readonly data: T;
}

export const envelopeSchema = z.object({
  kind: z.enum(RECORD_KINDS),
  schemaVersion: z.number().int().positive(),
  data: z.unknown(),
});

export function wrap<T>(kind: RecordKind, data: T): Envelope<T> {
  return { kind, schemaVersion: CURRENT_VERSION[kind], data };
}
