import type { EventBus, Timer } from '@/lib/core';
import {
  deserializeMany,
  type DrawingManager,
  type DrawingStyle,
  type SerializedDrawing,
} from '@/lib/drawings';
import { readEnvelope, wrap, type VersionedStore } from '@/lib/storage';
import type { AppEventMap } from '../app-events';
import { APP_CONFIG } from '../config';
import { debounce } from '../debounce';

interface DrawingsFile {
  symbol: string;
  drawings: unknown[];
}

const validateFile = (data: unknown): DrawingsFile | null => {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.drawings)) return null;
  return { symbol: typeof d.symbol === 'string' ? d.symbol : '', drawings: d.drawings };
};

const validateDefaults = (data: unknown): Record<string, DrawingStyle> | null =>
  typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, DrawingStyle>)
    : null;

export type DrawingImportResult =
  { ok: true; count: number; skipped: number } | { ok: false; error: string };

/**
 * Persists drawings per symbol (debounced autosave) and per-tool default styles, and handles
 * JSON import/export. Everything passes through the versioned envelope + migration pipeline.
 */
export class DrawingPersistence {
  private symbol: string | null = null;
  private loading = false;
  private readonly save: ReturnType<typeof debounce>;
  private readonly saveDefaults: ReturnType<typeof debounce>;
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly drawings: DrawingManager,
    private readonly store: VersionedStore,
    private readonly events: EventBus<AppEventMap>,
    timer: Timer,
  ) {
    this.save = debounce(timer, APP_CONFIG.persistDebounceMs, () => void this.saveNow());
    this.saveDefaults = debounce(timer, APP_CONFIG.persistDebounceMs, () => {
      void this.store.save(
        APP_CONFIG.storageKeys.toolDefaults,
        'toolDefaults',
        this.drawings.defaults.snapshot(),
      );
    });
    this.offs.push(
      drawings.events.on('drawings:changed', () => !this.loading && this.save()),
      drawings.defaults.onChange(() => !this.loading && this.saveDefaults()),
    );
  }

  async loadDefaults(): Promise<void> {
    const data = await this.store.load(
      APP_CONFIG.storageKeys.toolDefaults,
      'toolDefaults',
      validateDefaults,
    );
    if (!data) return;
    this.loading = true;
    this.drawings.defaults.load(data);
    this.loading = false;
  }

  /** Switches to `symbol`: flushes pending saves of the previous symbol, loads the new one. */
  async switchSymbol(symbol: string): Promise<void> {
    if (symbol === this.symbol) return;
    this.save.flush();
    this.symbol = symbol;
    this.loading = true;
    this.drawings.load([]);
    const file = await this.store.load(
      APP_CONFIG.storageKeys.drawings(symbol),
      'drawings',
      validateFile,
    );
    if (this.symbol !== symbol) return;
    const { drawings, skipped } = deserializeMany(file?.drawings ?? [], this.drawings.registry);
    this.drawings.load(drawings);
    this.loading = false;
    if (skipped.length)
      this.events.emit('toast', {
        message: `Skipped ${skipped.length} invalid drawing(s)`,
        kind: 'error',
      });
  }

  private async saveNow(): Promise<void> {
    if (!this.symbol) return;
    const data: { symbol: string; drawings: SerializedDrawing[] } = {
      symbol: this.symbol,
      drawings: this.drawings.serializeAll(),
    };
    await this.store.save(APP_CONFIG.storageKeys.drawings(this.symbol), 'drawings', data);
  }

  exportJson(): string {
    return JSON.stringify(
      wrap('drawings', { symbol: this.symbol, drawings: this.drawings.serializeAll() }),
      null,
      2,
    );
  }

  /** Adds the drawings of an exported file to the chart (new ids, undoable). */
  importJson(raw: unknown): DrawingImportResult {
    const res = readEnvelope(raw, 'drawings', validateFile);
    if (!res.ok) return { ok: false, error: res.error };
    const { drawings, skipped } = deserializeMany(
      res.value.drawings.map((d) =>
        typeof d === 'object' && d !== null ? { ...d, id: this.drawings.newId() } : d,
      ),
      this.drawings.registry,
    );
    this.drawings.add(drawings, false);
    return { ok: true, count: drawings.length, skipped: skipped.length };
  }

  destroy(): void {
    this.save.flush();
    this.saveDefaults.flush();
    for (const off of this.offs.splice(0)) off();
  }
}
