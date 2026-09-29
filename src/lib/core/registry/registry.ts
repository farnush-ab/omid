export interface Registrable {
  readonly id: string;
}

/** Ordered plugin registry. Registration order is display order. */
export class Registry<T extends Registrable> {
  private items = new Map<string, T>();

  constructor(readonly name: string) {}

  register(item: T): this {
    if (this.items.has(item.id))
      throw new Error(`${this.name}: "${item.id}" is already registered`);
    this.items.set(item.id, item);
    return this;
  }

  unregister(id: string): boolean {
    return this.items.delete(id);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  require(id: string): T {
    const item = this.items.get(id);
    if (!item) throw new Error(`${this.name}: "${id}" is not registered`);
    return item;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  list(): T[] {
    return [...this.items.values()];
  }

  ids(): string[] {
    return [...this.items.keys()];
  }
}
