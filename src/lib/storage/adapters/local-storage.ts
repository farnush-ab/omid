import type { StorageAdapter } from '@/lib/core';

/** window.localStorage adapter with a namespace prefix. Values are JSON-serialised. */
export class LocalStorageStorage implements StorageAdapter {
  readonly id = 'localStorage';

  constructor(
    private readonly storage: Storage,
    private readonly namespace = 'tc:',
  ) {}

  async get(key: string): Promise<unknown> {
    const raw = this.storage.getItem(this.namespace + key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    this.storage.setItem(this.namespace + key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(this.namespace + key);
  }

  async keys(prefix = ''): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k?.startsWith(this.namespace + prefix)) out.push(k.slice(this.namespace.length));
    }
    return out;
  }
}
