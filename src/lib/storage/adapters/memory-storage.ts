import type { StorageAdapter } from '@/lib/core';

/** In-memory adapter (tests, SSR-safe fallback). Values are structured-cloned like IndexedDB. */
export class MemoryStorage implements StorageAdapter {
  readonly id = 'memory';
  private map = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    const v = this.map.get(key);
    return v === undefined ? undefined : structuredClone(v);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(prefix = ''): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}
