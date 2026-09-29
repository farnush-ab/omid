import type { Candle, TimeframeId } from '@/lib/core';

/** Binance interval strings per timeframe. */
export const BINANCE_INTERVALS: Readonly<Record<TimeframeId, string>> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M',
};

export const BINANCE_MAX_LIMIT = 1000;

/** Public market-data hosts, tried in order. data-api.binance.vision is not geo-restricted. */
export const BINANCE_HOSTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
] as const;

/** Parses the /api/v3/klines array-of-arrays payload. Returns null if malformed. */
export function parseKlines(payload: unknown): Candle[] | null {
  if (!Array.isArray(payload)) return null;
  const out: Candle[] = [];
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 6) return null;
    const c: Candle = {
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    };
    if (!Object.values(c).every(Number.isFinite)) return null;
    out.push(c);
  }
  return out;
}

export function klinesQuery(p: {
  symbol: string;
  timeframe: TimeframeId;
  limit: number;
  startTime?: number | undefined;
  endTime?: number | undefined;
}): URLSearchParams {
  const q = new URLSearchParams({
    symbol: p.symbol,
    interval: BINANCE_INTERVALS[p.timeframe],
    limit: String(Math.min(BINANCE_MAX_LIMIT, Math.max(1, Math.floor(p.limit)))),
  });
  if (p.startTime !== undefined) q.set('startTime', String(Math.floor(p.startTime)));
  if (p.endTime !== undefined) q.set('endTime', String(Math.floor(p.endTime)));
  return q;
}
