import type { Candle } from '../data/candle';
import { bucketStart, canAggregate } from './buckets';
import type { TimeframeId } from './timeframes';

/** Merges `bar` into the forming candle `acc` (mutates and returns acc). */
export function mergeInto(acc: Candle, bar: Candle): Candle {
  if (bar.high > acc.high) acc.high = bar.high;
  if (bar.low < acc.low) acc.low = bar.low;
  acc.close = bar.close;
  acc.volume += bar.volume;
  return acc;
}

/**
 * Aggregates ascending bars of timeframe `from` into `to`. The last bucket may be partial
 * (a forming candle). Throws if the timeframes don't nest exactly.
 */
export function aggregate(bars: readonly Candle[], from: TimeframeId, to: TimeframeId): Candle[] {
  if (!canAggregate(from, to)) throw new Error(`Cannot aggregate ${from} into ${to}`);
  const out: Candle[] = [];
  let acc: Candle | null = null;
  for (const bar of bars) {
    const start = bucketStart(bar.time, to);
    if (acc && acc.time === start) {
      mergeInto(acc, bar);
    } else {
      acc = {
        time: start,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      };
      out.push(acc);
    }
  }
  return out;
}
