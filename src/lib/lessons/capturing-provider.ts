import type {
  BarsRequest,
  BarsResponse,
  Candle,
  DataProvider,
  SymbolInfo,
  TimeframeId,
} from '@/lib/core';

export type BarsSink = (
  symbol: SymbolInfo,
  timeframe: TimeframeId,
  bars: readonly Candle[],
) => void;

/**
 * Decorator that reports every bar served by the wrapped provider. While a recording is active
 * the sink stores them in the lesson; otherwise it is a transparent pass-through.
 */
export class CapturingProvider implements DataProvider {
  private sink: BarsSink | null = null;

  constructor(private readonly inner: DataProvider) {}

  get id(): string {
    return this.inner.id;
  }

  get label(): string {
    return this.inner.label;
  }

  setSink(sink: BarsSink | null): void {
    this.sink = sink;
  }

  async fetchBars(request: BarsRequest, signal?: AbortSignal): Promise<BarsResponse> {
    const res = await this.inner.fetchBars(request, signal);
    this.sink?.(this.inner.getSymbolInfo(request.symbol), request.timeframe, res.bars);
    return res;
  }

  searchSymbols(query: string): SymbolInfo[] {
    return this.inner.searchSymbols(query);
  }

  getSymbolInfo(symbol: string): SymbolInfo {
    return this.inner.getSymbolInfo(symbol);
  }
}
