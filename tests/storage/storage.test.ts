import { describe, expect, it } from 'vitest';
import {
  CURRENT_VERSION,
  LocalStorageStorage,
  MemoryStorage,
  MigrationError,
  VersionedStore,
  migrate,
  readEnvelope,
  validateMigrationChains,
  wrap,
} from '@/lib/storage';

class FakeStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('migrations', () => {
  it('every kind has a contiguous chain to the current version', () => {
    expect(validateMigrationChains()).toEqual([]);
  });

  it('migrates drawings v1 -> v2', () => {
    const v1 = {
      kind: 'drawings' as const,
      schemaVersion: 1,
      data: {
        symbol: 'BTCUSDT',
        drawings: [
          {
            id: 'a',
            tool: 'trend-line',
            pts: [
              [1, 100],
              [2, 200],
            ],
            style: { color: '#fff' },
            visible: false,
          },
        ],
      },
    };
    const out = migrate(v1);
    expect(out.schemaVersion).toBe(CURRENT_VERSION.drawings);
    expect(out.data).toEqual({
      symbol: 'BTCUSDT',
      drawings: [
        {
          id: 'a',
          type: 'trend-line',
          points: [
            { time: 1, price: 100 },
            { time: 2, price: 200 },
          ],
          style: { color: '#fff' },
          locked: false,
          hidden: true,
        },
      ],
    });
  });

  it('refuses data from a newer version', () => {
    expect(() => migrate({ kind: 'themes', schemaVersion: 99, data: {} })).toThrow(MigrationError);
  });

  it('readEnvelope rejects garbage and wrong kinds', () => {
    const ok = (d: unknown) => d;
    expect(readEnvelope(null, 'themes', ok).ok).toBe(false);
    expect(readEnvelope({ kind: 'nope', schemaVersion: 1, data: 1 }, 'themes', ok).ok).toBe(false);
    expect(readEnvelope(wrap('appState', {}), 'themes', ok).ok).toBe(false);
    expect(readEnvelope(wrap('themes', { a: 1 }), 'themes', () => null).ok).toBe(false);
  });
});

describe('VersionedStore', () => {
  for (const [name, make] of [
    ['memory', () => new MemoryStorage()],
    ['localStorage', () => new LocalStorageStorage(new FakeStorage())],
  ] as const) {
    it(`round-trips envelopes via ${name}`, async () => {
      const adapter = make();
      const store = new VersionedStore(adapter);
      await store.save('k', 'appState', { symbol: 'X' });
      expect(await adapter.get('k')).toEqual({
        kind: 'appState',
        schemaVersion: 1,
        data: { symbol: 'X' },
      });
      expect(await store.load('k', 'appState', (d) => d)).toEqual({ symbol: 'X' });
      expect(await adapter.keys('k')).toEqual(['k']);
    });
  }

  it('rewrites migrated data at the current version', async () => {
    const adapter = new MemoryStorage();
    await adapter.set('d', { kind: 'drawings', schemaVersion: 1, data: { drawings: [] } });
    const store = new VersionedStore(adapter);
    expect(await store.load('d', 'drawings', (d) => d)).toEqual({ drawings: [] });
    expect(((await adapter.get('d')) as { schemaVersion: number }).schemaVersion).toBe(2);
  });

  it('returns null for invalid stored data instead of throwing', async () => {
    const adapter = new MemoryStorage();
    await adapter.set('bad', { hello: 'world' });
    expect(await new VersionedStore(adapter).load('bad', 'themes', (d) => d)).toBeNull();
  });
});
