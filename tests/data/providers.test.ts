import { describe, expect, it, vi } from 'vitest';
import { aggregate, bucketStart, type DataProvider } from '@/lib/core';
import {
  BinanceProvider,
  FallbackProvider,
  SyntheticProvider,
  parseKlines,
  symbolInfo,
} from '@/lib/data';

const NOW = Date.UTC(2026, 8, 29, 12, 34);
const clock = { now: () => NOW };

describe('SyntheticProvider', () => {
  const p = new SyntheticProvider({ clock });

  it('is deterministic and ends at the current bucket', async () => {
    const a = await p.fetchBars({ symbol: 'BTCUSDT', timeframe: '1h', limit: 500 });
    const b = await new SyntheticProvider({ clock }).fetchBars({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      limit: 500,
    });
    expect(a.bars).toEqual(b.bars);
    expect(a.bars).toHaveLength(500);
    expect(a.bars.at(-1)!.time).toBe(bucketStart(NOW, '1h'));
  });

  it('produces valid, contiguous OHLC bars on the tick grid', async () => {
    const { bars } = await p.fetchBars({ symbol: 'ETHUSDT', timeframe: '15m', limit: 300 });
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]!;
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      expect(Math.abs(b.close / 0.01 - Math.round(b.close / 0.01))).toBeLessThan(1e-6);
      if (i > 0) expect(b.time - bars[i - 1]!.time).toBe(15 * 60_000);
    }
  });

  it('pages of history line up exactly', async () => {
    const all = await p.fetchBars({ symbol: 'SOLUSDT', timeframe: '4h', limit: 200 });
    const latest = await p.fetchBars({ symbol: 'SOLUSDT', timeframe: '4h', limit: 100 });
    const older = await p.fetchBars({
      symbol: 'SOLUSDT',
      timeframe: '4h',
      limit: 100,
      endTime: latest.bars[0]!.time - 1,
    });
    expect([...older.bars, ...latest.bars]).toEqual(all.bars);
  });

  it('supports forward range requests (replay)', async () => {
    const start = Date.UTC(2026, 8, 1);
    const { bars } = await p.fetchBars({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      limit: 30,
      startTime: start,
    });
    expect(bars[0]!.time).toBe(start);
    expect(bars).toHaveLength(30);
  });

  it('handles calendar timeframes', async () => {
    const { bars } = await p.fetchBars({ symbol: 'BTCUSDT', timeframe: '1M', limit: 24 });
    expect(bars.every((b) => new Date(b.time).getUTCDate() === 1)).toBe(true);
    const weeks = await p.fetchBars({ symbol: 'BTCUSDT', timeframe: '1W', limit: 10 });
    expect(weeks.bars.every((b) => new Date(b.time).getUTCDay() === 1)).toBe(true);
  });

  it('daily bars roughly agree with aggregated hourly bars', async () => {
    const hours = await p.fetchBars({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      limit: 24 * 5,
      endTime: Date.UTC(2026, 8, 20) - 1,
    });
    const days = aggregate(hours.bars, '1h', '1D');
    const direct = await p.fetchBars({
      symbol: 'BTCUSDT',
      timeframe: '1D',
      limit: 5,
      endTime: Date.UTC(2026, 8, 20) - 1,
    });
    for (let i = 0; i < 5; i++) {
      expect(direct.bars[i]!.open).toBeCloseTo(days[i]!.open, 0);
      expect(direct.bars[i]!.close).toBeCloseTo(days[i]!.close, 0);
    }
  });
});

describe('Binance adapters', () => {
  it('parses klines payloads', () => {
    const bars = parseKlines([
      [1700000000000, '1.5', '2', '1', '1.8', '123.4', 1700000059999, '0', 1, '0', '0', '0'],
    ]);
    expect(bars).toEqual([
      { time: 1700000000000, open: 1.5, high: 2, low: 1, close: 1.8, volume: 123.4 },
    ]);
    expect(parseKlines({})).toBeNull();
    expect(parseKlines([[1, 'x', 2, 3, 4, 5]])).toBeNull();
  });

  it('pages backwards for requests above 1000 bars', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(url);
      const q = new URL(url, 'http://x').searchParams;
      const end = Number(q.get('endTime') ?? 1_000_000_000);
      const limit = Number(q.get('limit'));
      const bars = Array.from({ length: limit }, (_, i) => ({
        time: end - (limit - i) * 60_000,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
      }));
      return new Response(JSON.stringify({ bars, source: 'binance', hasMoreHistory: true }));
    });
    const p = new BinanceProvider(fetchFn);
    const res = await p.fetchBars({ symbol: 'BTCUSDT', timeframe: '1m', limit: 2500 });
    expect(calls).toHaveLength(3);
    expect(res.bars).toHaveLength(2500);
    for (let i = 1; i < res.bars.length; i++)
      expect(res.bars[i]!.time).toBeGreaterThan(res.bars[i - 1]!.time);
  });

  it('falls back to the secondary provider on failure', async () => {
    const failing: DataProvider = {
      id: 'x',
      label: 'x',
      fetchBars: () => Promise.reject(new Error('down')),
      searchSymbols: () => [],
      getSymbolInfo: symbolInfo,
    };
    const onFallback = vi.fn();
    const p = new FallbackProvider(failing, new SyntheticProvider({ clock }), onFallback);
    const res = await p.fetchBars({ symbol: 'BTCUSDT', timeframe: '1h', limit: 5 });
    expect(res.source).toBe('synthetic');
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it('exposes symbol precision from the tick size', () => {
    expect(symbolInfo('BTCUSDT').pricePrecision).toBe(2);
    expect(symbolInfo('DOGEUSDT').pricePrecision).toBe(5);
    expect(symbolInfo('unknownusdt').symbol).toBe('UNKNOWNUSDT');
  });
});
