import { bucketStart, nextBucketStart, type Candle, type TimeframeId } from '@/lib/core';
import { barNoise, pricePath, wickAmplitude } from './price-path';

const INTERIOR_SAMPLES = 6;
const BASE_VOLUME_PER_HOUR = 1200;

/** Start of the bucket before the one starting at `start`. */
export function previousBucketStart(start: number, tf: TimeframeId): number {
  return bucketStart(start - 1, tf);
}

/** One synthetic OHLCV bar for the bucket starting at `time`. */
export function syntheticBar(
  time: number,
  tf: TimeframeId,
  seed: number,
  refPrice: number,
  tickSize: number,
): Candle {
  const end = nextBucketStart(time, tf);
  const ms = end - time;
  const round = (p: number) => Math.max(tickSize, Math.round(p / tickSize) * tickSize);
  const open = pricePath(time, seed, refPrice);
  const close = pricePath(end, seed, refPrice);
  let high = Math.max(open, close);
  let low = Math.min(open, close);
  for (let k = 1; k < INTERIOR_SAMPLES; k++) {
    const p = pricePath(time + (ms * k) / INTERIOR_SAMPLES, seed, refPrice);
    if (p > high) high = p;
    if (p < low) low = p;
  }
  const wick = wickAmplitude(ms) * 0.35;
  high *= 1 + wick * barNoise(seed, time, 1);
  low *= 1 - wick * barNoise(seed, time, 2);
  const move = Math.abs(close - open) / open;
  const volume =
    BASE_VOLUME_PER_HOUR * (ms / 3_600_000) * (0.4 + barNoise(seed, time, 3)) * (1 + move * 40);
  return {
    time,
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close),
    volume: Math.round(volume * 1000) / 1000,
  };
}

/** `limit` consecutive bars ending with the bucket containing `endTime` (ascending). */
export function generateBars(
  endTime: number,
  limit: number,
  tf: TimeframeId,
  seed: number,
  refPrice: number,
  tickSize: number,
  minTime = Number.NEGATIVE_INFINITY,
): Candle[] {
  const out: Candle[] = [];
  let t = bucketStart(endTime, tf);
  for (let i = 0; i < limit && t >= minTime; i++) {
    out.push(syntheticBar(t, tf, seed, refPrice, tickSize));
    t = previousBucketStart(t, tf);
  }
  return out.reverse();
}

/** Up to `limit` consecutive bars starting with the bucket containing `startTime`. */
export function generateBarsForward(
  startTime: number,
  endTime: number,
  limit: number,
  tf: TimeframeId,
  seed: number,
  refPrice: number,
  tickSize: number,
): Candle[] {
  const out: Candle[] = [];
  for (
    let t = bucketStart(startTime, tf);
    out.length < limit && t <= endTime;
    t = nextBucketStart(t, tf)
  ) {
    out.push(syntheticBar(t, tf, seed, refPrice, tickSize));
  }
  return out;
}
