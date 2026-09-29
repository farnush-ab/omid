import {
  bucketStart,
  hashString,
  type BarsRequest,
  type BarsResponse,
  type Clock,
  type DataProvider,
} from '@/lib/core';
import { referencePrice, searchSymbols, symbolInfo } from '../symbols';
import { generateBars, generateBarsForward } from './generate';

/** Synthetic history starts here (like a listing date). */
export const SYNTHETIC_EPOCH = Date.UTC(2017, 0, 2);

export interface SyntheticProviderOptions {
  readonly clock: Clock;
  readonly seed?: number;
}

/** Deterministic offline data source (seeded). Also used as the network fallback. */
export class SyntheticProvider implements DataProvider {
  readonly id = 'synthetic';
  readonly label = 'Synthetic (offline)';

  constructor(private readonly opts: SyntheticProviderOptions) {}

  async fetchBars(req: BarsRequest): Promise<BarsResponse> {
    return this.generate(req);
  }

  /** Synchronous variant (used by the API route fallback and tests). */
  generate(req: BarsRequest): BarsResponse {
    const info = symbolInfo(req.symbol);
    const seed = (hashString(info.symbol) ^ (this.opts.seed ?? 0)) >>> 0;
    const now = this.opts.clock.now();
    const end = Math.min(req.endTime ?? now, now);
    const ref = referencePrice(info.symbol);
    const bars =
      req.startTime !== undefined
        ? generateBarsForward(
            Math.max(req.startTime, SYNTHETIC_EPOCH),
            end,
            req.limit,
            req.timeframe,
            seed,
            ref,
            info.tickSize,
          )
        : generateBars(end, req.limit, req.timeframe, seed, ref, info.tickSize, SYNTHETIC_EPOCH);
    const first = bars[0];
    return {
      bars,
      source: 'synthetic',
      hasMoreHistory: !!first && bucketStart(first.time - 1, req.timeframe) >= SYNTHETIC_EPOCH,
    };
  }

  searchSymbols = searchSymbols;
  getSymbolInfo = symbolInfo;
}
