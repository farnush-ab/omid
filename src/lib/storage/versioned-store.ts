import type { StorageAdapter } from '@/lib/core';
import { envelopeSchema, wrap, type Envelope, type RecordKind } from './envelope';
import { migrate } from './migrations';

export type Validator<T> = (data: unknown) => T | null;

export type LoadResult<T> =
  | { readonly ok: true; readonly value: T; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly error: string };

/**
 * Parses an untrusted value (storage or an imported file) as an envelope of `kind`,
 * migrates it to the current version and validates the payload.
 */
export function readEnvelope<T>(
  raw: unknown,
  kind: RecordKind,
  validate: Validator<T>,
): LoadResult<T> {
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Not a valid TradingChart file' };
  if (parsed.data.kind !== kind)
    return { ok: false, error: `Expected ${kind}, got ${parsed.data.kind}` };
  let env: Envelope;
  try {
    env = migrate(parsed.data as Envelope);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const value = validate(env.data);
  if (value === null) return { ok: false, error: `Invalid ${kind} data` };
  return {
    ok: true,
    value,
    migratedFrom:
      parsed.data.schemaVersion === env.schemaVersion ? null : parsed.data.schemaVersion,
  };
}

/** Typed, versioned persistence on top of any StorageAdapter. */
export class VersionedStore {
  constructor(readonly adapter: StorageAdapter) {}

  async load<T>(key: string, kind: RecordKind, validate: Validator<T>): Promise<T | null> {
    try {
      const raw = await this.adapter.get(key);
      if (raw === undefined) return null;
      const res = readEnvelope(raw, kind, validate);
      if (!res.ok) {
        console.warn(`[storage] ignoring ${key}: ${res.error}`);
        return null;
      }
      if (res.migratedFrom !== null) await this.save(key, kind, res.value);
      return res.value;
    } catch (e) {
      console.warn(`[storage] failed to load ${key}`, e);
      return null;
    }
  }

  async save<T>(key: string, kind: RecordKind, data: T): Promise<void> {
    try {
      await this.adapter.set(key, wrap(kind, data));
    } catch (e) {
      console.warn(`[storage] failed to save ${key}`, e);
    }
  }

  remove(key: string): Promise<void> {
    return this.adapter.remove(key);
  }
}
