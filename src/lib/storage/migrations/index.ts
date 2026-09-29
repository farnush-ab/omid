import { CURRENT_VERSION, type Envelope, type RecordKind } from '../envelope';
import { drawingsV1ToV2 } from './drawings-v1-to-v2';
import type { Migration } from './types';

export type { Migration } from './types';

/** Every migration ever shipped. Register new steps here (append only). */
export const MIGRATIONS: readonly Migration[] = [drawingsV1ToV2];

export class MigrationError extends Error {}

/** Runs `envelope` through the migration chain up to the current version of its kind. */
export function migrate(
  envelope: Envelope,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = CURRENT_VERSION[envelope.kind],
): Envelope {
  let { schemaVersion, data } = envelope;
  if (schemaVersion > target) {
    throw new MigrationError(
      `${envelope.kind} v${schemaVersion} was written by a newer version (supported: v${target})`,
    );
  }
  while (schemaVersion < target) {
    const step = migrations.find((m) => m.kind === envelope.kind && m.from === schemaVersion);
    if (!step) throw new MigrationError(`No migration for ${envelope.kind} v${schemaVersion}`);
    data = step.migrate(data);
    schemaVersion = step.to;
  }
  return { kind: envelope.kind, schemaVersion, data };
}

/** Sanity check used by tests: every kind has a contiguous chain from v1 to current. */
export function validateMigrationChains(migrations: readonly Migration[] = MIGRATIONS): string[] {
  const errors: string[] = [];
  for (const kind of Object.keys(CURRENT_VERSION) as RecordKind[]) {
    for (let v = 1; v < CURRENT_VERSION[kind]; v++) {
      if (!migrations.some((m) => m.kind === kind && m.from === v && m.to === v + 1)) {
        errors.push(`${kind}: missing v${v} -> v${v + 1}`);
      }
    }
  }
  return errors;
}
