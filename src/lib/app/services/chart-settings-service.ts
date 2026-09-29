import type { ChartEngine, ChartOptions, CommandHistory, Timer } from '@/lib/core';
import type { VersionedStore } from '@/lib/storage';
import { UpdateChartOptionsCommand } from '../commands/update-chart-options';
import { APP_CONFIG } from '../config';
import { debounce } from '../debounce';
import { parseChartOptions } from '../settings/chart-options-schema';

/** Applies chart-option changes through the command history and persists them. */
export class ChartSettingsService {
  private readonly persist: ReturnType<typeof debounce>;
  private readonly off: () => void;

  constructor(
    private readonly engine: ChartEngine,
    private readonly history: CommandHistory,
    private readonly store: VersionedStore,
    timer: Timer,
  ) {
    this.persist = debounce(timer, APP_CONFIG.persistDebounceMs, () => {
      void this.store.save(
        APP_CONFIG.storageKeys.chartSettings,
        'chartSettings',
        this.engine.getOptions(),
      );
    });
    this.off = engine.events.on('options:changed', () => this.persist());
  }

  async load(): Promise<void> {
    const opts = await this.store.load(
      APP_CONFIG.storageKeys.chartSettings,
      'chartSettings',
      parseChartOptions,
    );
    if (opts) this.engine.setOptions(opts);
  }

  get options(): Readonly<ChartOptions> {
    return this.engine.getOptions();
  }

  /** Undoable update. `mergeable` lets rapid edits of one control collapse into one step. */
  update(patch: Partial<ChartOptions>, mergeable = false): void {
    const current = this.engine.getOptions();
    const before: Partial<ChartOptions> = {};
    for (const k of Object.keys(patch) as (keyof ChartOptions)[]) {
      (before as Record<string, unknown>)[k] = current[k];
    }
    if (
      Object.keys(patch).every(
        (k) => current[k as keyof ChartOptions] === patch[k as keyof ChartOptions],
      )
    )
      return;
    this.history.execute(new UpdateChartOptionsCommand(this.engine, before, patch), { mergeable });
  }

  toggle(key: 'autoScale' | 'invertScale' | 'lockScale' | 'volumeVisible'): void {
    this.update({ [key]: !this.engine.getOptions()[key] });
  }

  toggleScaleMode(mode: 'log' | 'percent'): void {
    this.update({ scaleMode: this.engine.getOptions().scaleMode === mode ? 'linear' : mode });
  }

  destroy(): void {
    this.persist.flush();
    this.off();
  }
}
