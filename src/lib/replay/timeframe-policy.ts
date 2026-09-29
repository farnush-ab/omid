import {
  TIMEFRAMES,
  TIMEFRAME_IDS,
  canAggregate,
  compareTimeframes,
  type TimeframeId,
} from '@/lib/core';

/**
 * Picks the replay step resolution after switching the chart to `chartTf`.
 * Lower timeframe → step at it; higher → keep the finer base so the higher candle forms
 * progressively; if the base does not nest (e.g. 1W into 1M) → the coarsest one that does.
 */
export function resolveBaseTimeframe(currentBase: TimeframeId, chartTf: TimeframeId): TimeframeId {
  if (compareTimeframes(chartTf, currentBase) <= 0) return chartTf;
  if (canAggregate(currentBase, chartTf)) return currentBase;
  const candidates = TIMEFRAME_IDS.filter(
    (id) => TIMEFRAMES[id].ms <= TIMEFRAMES[currentBase].ms && canAggregate(id, chartTf),
  );
  return candidates[candidates.length - 1] ?? chartTf;
}
