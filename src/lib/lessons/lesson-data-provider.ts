import type { BarsRequest, BarsResponse, Candle, DataProvider, SymbolInfo } from '@/lib/core';
import { datasetKey, datasetToCandles } from './dataset';
import type { LessonDataset } from './types';

const lowerBound = (bars: readonly Candle[], time: number): number => {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (bars[mid]!.time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/**
 * Serves market data exclusively from a lesson's embedded datasets, so playback is identical on
 * every machine and never touches the network.
 */
export class LessonDataProvider implements DataProvider {
  readonly id = 'lesson';
  readonly label = 'Lesson data';
  private readonly bars = new Map<string, Candle[]>();
  private readonly symbols = new Map<string, SymbolInfo>();

  constructor(datasets: readonly LessonDataset[]) {
    for (const d of datasets) {
      this.bars.set(d.key, datasetToCandles(d));
      this.symbols.set(d.symbol.symbol, d.symbol);
    }
  }

  /** All bars of one dataset, or an empty list. */
  candles(symbol: string, timeframe: string): readonly Candle[] {
    return this.bars.get(`${symbol}|${timeframe}`) ?? [];
  }

  async fetchBars(req: BarsRequest): Promise<BarsResponse> {
    const all = this.bars.get(datasetKey(req.symbol, req.timeframe)) ?? [];
    let from: number;
    let to: number;
    if (req.startTime !== undefined) {
      from = lowerBound(all, req.startTime);
      const end = req.endTime !== undefined ? lowerBound(all, req.endTime + 1) : all.length;
      to = Math.min(end, from + req.limit);
    } else {
      to = req.endTime !== undefined ? lowerBound(all, req.endTime + 1) : all.length;
      from = Math.max(0, to - req.limit);
    }
    return { bars: all.slice(from, to), source: 'lesson', hasMoreHistory: from > 0 };
  }

  searchSymbols(query: string): SymbolInfo[] {
    const q = query.trim().toUpperCase();
    return [...this.symbols.values()].filter((s) => s.symbol.includes(q));
  }

  getSymbolInfo(symbol: string): SymbolInfo {
    return (
      this.symbols.get(symbol) ?? {
        symbol,
        description: symbol,
        tickSize: 0.01,
        pricePrecision: 2,
        qtyStep: 0.001,
        quoteCurrency: '',
        baseCurrency: '',
      }
    );
  }
}
