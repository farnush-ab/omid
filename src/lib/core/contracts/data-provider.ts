import type { Candle } from '../data/candle';
import type { TimeframeId } from '../time/timeframes';
import type { SymbolInfo } from './symbol';

export interface BarsRequest {
  readonly symbol: string;
  readonly timeframe: TimeframeId;
  /** Inclusive start (ms). */
  readonly startTime?: number;
  /** Inclusive end (ms). Omit for "latest". */
  readonly endTime?: number;
  readonly limit: number;
}

export interface BarsResponse {
  readonly bars: Candle[];
  /** Where the bars came from, e.g. "binance" or "synthetic". */
  readonly source: string;
  /** False when the provider knows there is no older history. */
  readonly hasMoreHistory: boolean;
}

/** Port for market data. Implementations live in src/lib/data and are injected. */
export interface DataProvider {
  readonly id: string;
  readonly label: string;
  fetchBars(request: BarsRequest, signal?: AbortSignal): Promise<BarsResponse>;
  searchSymbols(query: string): SymbolInfo[];
  getSymbolInfo(symbol: string): SymbolInfo;
}
