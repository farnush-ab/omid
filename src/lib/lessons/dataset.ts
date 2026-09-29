import type { Candle, SymbolInfo, TimeframeId } from '@/lib/core';
import type { LessonDataset } from './types';

export const datasetKey = (symbol: string, timeframe: TimeframeId): string =>
  `${symbol}|${timeframe}`;

interface Entry {
  symbol: SymbolInfo;
  timeframe: TimeframeId;
  bars: Map<number, Candle>;
}

/**
 * Collects every bar the recording session saw, per symbol/timeframe, so the lesson replays from
 * its own copy of the market data and never from a live source that could have changed.
 */
export class DatasetCollector {
  private readonly entries = new Map<string, Entry>();
  private version = 0;

  add(symbol: SymbolInfo, timeframe: TimeframeId, bars: readonly Candle[]): void {
    const key = datasetKey(symbol.symbol, timeframe);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { symbol, timeframe, bars: new Map() };
      this.entries.set(key, entry);
    }
    for (const b of bars) entry.bars.set(b.time, b);
    if (bars.length > 0 || entry.bars.size === 0) this.version += 1;
  }

  /** Increments whenever new bars arrive (drives draft autosave). */
  get revision(): number {
    return this.version;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  toDatasets(): LessonDataset[] {
    return [...this.entries.entries()].map(([key, e]) =>
      candlesToDataset(key, e.symbol, e.timeframe, [...e.bars.values()]),
    );
  }

  static from(datasets: readonly LessonDataset[]): DatasetCollector {
    const c = new DatasetCollector();
    for (const d of datasets) c.add(d.symbol, d.timeframe, datasetToCandles(d));
    return c;
  }
}

export function candlesToDataset(
  key: string,
  symbol: SymbolInfo,
  timeframe: TimeframeId,
  candles: readonly Candle[],
): LessonDataset {
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const columns: LessonDataset['columns'] = [[], [], [], [], [], []];
  for (const c of sorted) {
    columns[0].push(c.time);
    columns[1].push(c.open);
    columns[2].push(c.high);
    columns[3].push(c.low);
    columns[4].push(c.close);
    columns[5].push(c.volume);
  }
  return { key, symbol, timeframe, columns };
}

export function datasetToCandles(d: LessonDataset): Candle[] {
  const [time, open, high, low, close, volume] = d.columns;
  return time.map((t, i) => ({
    time: t,
    open: open[i]!,
    high: high[i]!,
    low: low[i]!,
    close: close[i]!,
    volume: volume[i]!,
  }));
}
