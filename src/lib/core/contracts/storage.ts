/** Port for key/value persistence. Implementations live in src/lib/storage and are injected. */
export interface StorageAdapter {
  readonly id: string;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}
