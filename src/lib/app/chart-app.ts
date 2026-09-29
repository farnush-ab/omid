import {
  ChartEngine,
  CommandHistory,
  EventBus,
  createIdGenerator,
  type TimeframeId,
} from '@/lib/core';
import { DrawingManager, drawingRegistry } from '@/lib/drawings';
import { DEFAULT_SERIES_ID, seriesRegistry } from '@/lib/series';
import { VersionedStore } from '@/lib/storage';
import { themeRegistry, DEFAULT_THEME_ID } from '@/lib/themes';
import type { AppEventMap } from './app-events';
import type { AppDependencies } from './composition';
import { APP_CONFIG } from './config';
import { MarketDataController } from './services/market-data-controller';
import { ChartSettingsService } from './services/chart-settings-service';
import { ThemeService } from './services/theme-service';
import { loadAppState, saveAppState } from './services/app-state';
import { DrawingPersistence } from './services/drawing-persistence';
import { drawingShortcuts } from './shortcuts/drawing-shortcuts';
import { DEFAULT_SHORTCUTS } from './shortcuts/default-shortcuts';
import { KeyboardController } from './shortcuts/keyboard-controller';
import { ShortcutRegistry } from './shortcuts/shortcut-registry';

export interface ChartAppOptions {
  readonly initialBars?: number;
}

/**
 * Application facade and composition of all services. Framework-agnostic: the React layer
 * only mounts it, forwards input and subscribes to `events` / `engine.events`.
 */
export class ChartApp {
  readonly events = new EventBus<AppEventMap>();
  readonly history = new CommandHistory();
  readonly engine: ChartEngine;
  readonly market: MarketDataController;
  readonly themes: ThemeService;
  readonly settings: ChartSettingsService;
  readonly drawings: DrawingManager;
  readonly drawingStore: DrawingPersistence;
  readonly shortcuts = new ShortcutRegistry<ChartApp>();
  readonly keyboard: KeyboardController<ChartApp>;
  readonly store: VersionedStore;
  private readonly disposers: Array<() => void> = [];
  private destroyed = false;
  private loadedSymbol: string | null = null;

  constructor(
    container: HTMLElement,
    readonly deps: AppDependencies,
    options: ChartAppOptions = {},
  ) {
    const newId = createIdGenerator(deps.rng);
    this.store = new VersionedStore(deps.storage);
    this.engine = new ChartEngine({
      container,
      runtime: deps.runtime,
      series: seriesRegistry.require(DEFAULT_SERIES_ID),
      theme: themeRegistry.require(DEFAULT_THEME_ID),
      symbol: deps.provider.getSymbolInfo(APP_CONFIG.defaultSymbol),
      timeframe: APP_CONFIG.defaultTimeframe,
    });
    this.market = new MarketDataController(
      this.engine,
      deps.provider,
      this.events,
      { symbol: APP_CONFIG.defaultSymbol, timeframe: APP_CONFIG.defaultTimeframe },
      options.initialBars,
    );
    this.themes = new ThemeService(this.engine, this.store, this.events, newId);
    this.settings = new ChartSettingsService(
      this.engine,
      this.history,
      this.store,
      deps.runtime.timer,
    );
    this.drawings = new DrawingManager(this.engine, this.history, drawingRegistry, newId);
    this.drawingStore = new DrawingPersistence(
      this.drawings,
      this.store,
      this.events,
      deps.runtime.timer,
    );
    // Registration order is match priority: drawing shortcuts (e.g. arrows nudging a selection)
    // come before the generic chart ones.
    for (const s of drawingShortcuts()) this.shortcuts.register(s);
    for (const s of DEFAULT_SHORTCUTS) this.shortcuts.register(s);
    this.keyboard = new KeyboardController<ChartApp>(
      this.shortcuts,
      {
        context: this as ChartApp,
        setTimeframe: (tf) => void this.setTimeframe(tf),
        intervalTyperChanged: (text, valid) => this.events.emit('interval-typer', { text, valid }),
        startSymbolSearch: (initial) =>
          this.events.emit('ui:command', { type: 'open-symbol-search', initial }),
      },
      deps.runtime.timer,
    );
    this.disposers.push(
      this.history.onChange((s) => this.events.emit('history:changed', s)),
      this.events.on('market:changed', ({ symbol }) => {
        if (symbol.symbol !== this.loadedSymbol) {
          this.loadedSymbol = symbol.symbol;
          this.history.clear();
          void this.drawingStore.switchSymbol(symbol.symbol);
        }
      }),
    );
  }

  /** Loads persisted state, then data. Call once after construction. */
  async start(): Promise<void> {
    const [state] = await Promise.all([
      loadAppState(this.store),
      this.themes.load(),
      this.settings.load(),
    ]);
    if (this.destroyed) return;
    await this.market.load(
      state?.symbol ?? APP_CONFIG.defaultSymbol,
      state?.timeframe ?? APP_CONFIG.defaultTimeframe,
    );
  }

  get symbol(): string {
    return this.market.state.symbol.symbol;
  }

  get timeframe(): TimeframeId {
    return this.market.state.timeframe;
  }

  async setSymbol(symbol: string): Promise<void> {
    const s = symbol.trim().toUpperCase();
    if (!s || s === this.symbol) return;
    await this.market.load(s, this.timeframe);
    void saveAppState(this.store, { symbol: this.symbol, timeframe: this.timeframe });
  }

  async setTimeframe(tf: TimeframeId): Promise<void> {
    if (tf === this.timeframe) return;
    await this.market.load(this.symbol, tf);
    void saveAppState(this.store, { symbol: this.symbol, timeframe: this.timeframe });
  }

  /** Whether a drawing is selected (arrow keys nudge it instead of scrolling). */
  hasSelection(): boolean {
    return this.drawings.selected !== null;
  }

  destroy(): void {
    this.destroyed = true;
    for (const d of this.disposers.splice(0)) d();
    this.keyboard.destroy();
    this.drawingStore.destroy();
    this.drawings.destroy();
    this.settings.destroy();
    this.market.destroy();
    this.engine.destroy();
    this.events.clear();
  }
}
