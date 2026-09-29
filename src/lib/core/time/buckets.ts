import { FIRST_MONDAY_MS, WEEK_MS } from './constants';
import { TIMEFRAMES, type TimeframeId } from './timeframes';

/** Start (ms, UTC) of the bucket of `tf` containing `time`. Matches Binance kline alignment. */
export function bucketStart(time: number, tfId: TimeframeId): number {
  const tf = TIMEFRAMES[tfId];
  switch (tf.unit) {
    case 'minute':
    case 'hour':
    case 'day':
      return Math.floor(time / tf.ms) * tf.ms;
    case 'week':
      return Math.floor((time - FIRST_MONDAY_MS) / WEEK_MS) * WEEK_MS + FIRST_MONDAY_MS;
    case 'month': {
      const d = new Date(time);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
  }
}

/** Start of the bucket following the one that starts at `start`. */
export function nextBucketStart(start: number, tfId: TimeframeId): number {
  const tf = TIMEFRAMES[tfId];
  if (tf.unit !== 'month') return bucketStart(start, tfId) + tf.ms;
  const d = new Date(start);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** Exclusive end of the bucket starting at `start`. */
export const bucketEnd = nextBucketStart;

/** Can bars of `from` be aggregated exactly into `to` buckets? */
export function canAggregate(from: TimeframeId, to: TimeframeId): boolean {
  const a = TIMEFRAMES[from];
  const b = TIMEFRAMES[to];
  if (a.id === b.id) return true;
  if (a.ms > b.ms) return false;
  if (b.unit === 'month') return a.unit !== 'week';
  if (b.unit === 'week') return a.unit !== 'month';
  return b.ms % a.ms === 0;
}
