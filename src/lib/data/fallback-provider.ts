import type { BarsRequest, BarsResponse, DataProvider } from '@/lib/core';

/** Tries `primary`; on any non-abort failure answers from `fallback` (e.g. synthetic data). */
export class FallbackProvider implements DataProvider {
  readonly id: string;
  readonly label: string;

  constructor(
    private readonly primary: DataProvider,
    private readonly fallback: DataProvider,
    private readonly onFallback: (error: unknown) => void = () => undefined,
  ) {
    this.id = `${primary.id}+${fallback.id}`;
    this.label = primary.label;
  }

  async fetchBars(req: BarsRequest, signal?: AbortSignal): Promise<BarsResponse> {
    try {
      return await this.primary.fetchBars(req, signal);
    } catch (e) {
      if (signal?.aborted) throw e;
      this.onFallback(e);
      return this.fallback.fetchBars(req, signal);
    }
  }

  searchSymbols(query: string) {
    return this.primary.searchSymbols(query);
  }

  getSymbolInfo(symbol: string) {
    return this.primary.getSymbolInfo(symbol);
  }
}
