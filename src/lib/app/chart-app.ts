import { ChartEngine, SeriesData, type TimeframeId } from '@/lib/core';
import { SyntheticProvider, symbolInfo } from '@/lib/data';
import { DEFAULT_SERIES_ID, seriesRegistry } from '@/lib/series';
import { DEFAULT_THEME_ID, themeRegistry } from '@/lib/themes';
import { createBrowserRuntime, systemClock } from './browser-runtime';

/** Composition root: wires engine, data, drawings, replay, persistence. Framework-agnostic. */
export class ChartApp {
  readonly engine: ChartEngine;
  private readonly provider = new SyntheticProvider({ clock: systemClock });
  private symbol = 'BTCUSDT';
  private timeframe: TimeframeId = '1h';

  constructor(container: HTMLElement) {
    this.engine = new ChartEngine({
      container,
      runtime: createBrowserRuntime(),
      series: seriesRegistry.require(DEFAULT_SERIES_ID),
      theme: themeRegistry.require(DEFAULT_THEME_ID),
      symbol: symbolInfo(this.symbol),
      timeframe: this.timeframe,
    });
    void this.load();
  }

  private async load(): Promise<void> {
    const res = await this.provider.fetchBars({
      symbol: this.symbol,
      timeframe: this.timeframe,
      limit: 1000,
    });
    this.engine.setData(SeriesData.fromCandles(res.bars), { resetView: true });
  }

  destroy(): void {
    this.engine.destroy();
  }
}
