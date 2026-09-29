import { describe, expect, it } from 'vitest';
import {
  aggregate,
  bucketStart,
  canAggregate,
  nextBucketStart,
  parseTimeframeInput,
  type Candle,
  type TimeframeId,
} from '@/lib/core';

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

describe('bucketStart / nextBucketStart', () => {
  const t = Date.UTC(2024, 2, 13, 14, 37, 12); // Wed 13 Mar 2024 14:37:12 UTC
  const cases: Array<[TimeframeId, number]> = [
    ['1m', Date.UTC(2024, 2, 13, 14, 37)],
    ['3m', Date.UTC(2024, 2, 13, 14, 36)],
    ['5m', Date.UTC(2024, 2, 13, 14, 35)],
    ['15m', Date.UTC(2024, 2, 13, 14, 30)],
    ['30m', Date.UTC(2024, 2, 13, 14, 30)],
    ['1h', Date.UTC(2024, 2, 13, 14)],
    ['2h', Date.UTC(2024, 2, 13, 14)],
    ['4h', Date.UTC(2024, 2, 13, 12)],
    ['1D', Date.UTC(2024, 2, 13)],
    ['1W', Date.UTC(2024, 2, 11)], // Monday
    ['1M', Date.UTC(2024, 2, 1)],
  ];
  for (const [tf, expected] of cases) {
    it(`aligns ${tf} like Binance`, () => {
      expect(bucketStart(t, tf)).toBe(expected);
      expect(bucketStart(expected, tf)).toBe(expected);
    });
  }

  it('handles month lengths and year rollover', () => {
    expect(nextBucketStart(Date.UTC(2024, 1, 1), '1M')).toBe(Date.UTC(2024, 2, 1)); // leap Feb
    expect(nextBucketStart(Date.UTC(2023, 11, 1), '1M')).toBe(Date.UTC(2024, 0, 1));
    expect(nextBucketStart(Date.UTC(2024, 2, 11), '1W')).toBe(Date.UTC(2024, 2, 18));
  });

  it('weeks start on Monday even across year boundaries', () => {
    expect(new Date(bucketStart(Date.UTC(2025, 0, 1), '1W')).getUTCDay()).toBe(1);
    expect(bucketStart(Date.UTC(2025, 0, 1), '1W')).toBe(Date.UTC(2024, 11, 30));
  });
});

function minuteBars(start: number, count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * MIN,
    open: 100 + i,
    high: 100 + i + 2,
    low: 100 + i - 3,
    close: 100 + i + 1,
    volume: 1,
  }));
}

describe('aggregate', () => {
  it('aggregates 1m into 5m with correct OHLCV', () => {
    const out = aggregate(minuteBars(Date.UTC(2024, 0, 1, 0, 0), 10), '1m', '5m');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      time: Date.UTC(2024, 0, 1),
      open: 100,
      high: 106,
      low: 97,
      close: 105,
      volume: 5,
    });
    expect(out[1]!.open).toBe(105);
    expect(out[1]!.close).toBe(110);
  });

  it('keeps a partial (forming) last bucket', () => {
    const out = aggregate(minuteBars(Date.UTC(2024, 0, 1, 0, 0), 7), '1m', '5m');
    expect(out).toHaveLength(2);
    expect(out[1]!.volume).toBe(2);
    expect(out[1]!.close).toBe(107);
  });

  it('aligns to bucket boundaries when data starts mid-bucket', () => {
    const out = aggregate(minuteBars(Date.UTC(2024, 0, 1, 0, 3), 5), '1m', '15m');
    expect(out).toHaveLength(1);
    expect(out[0]!.time).toBe(Date.UTC(2024, 0, 1, 0, 0));
  });

  it('aggregates days into weeks and months', () => {
    const days: Candle[] = Array.from({ length: 62 }, (_, i) => ({
      time: Date.UTC(2024, 0, 1) + i * D,
      open: i,
      high: i + 1,
      low: i - 1,
      close: i + 0.5,
      volume: 10,
    }));
    const months = aggregate(days, '1D', '1M');
    expect(months.map((m) => m.time)).toEqual([
      Date.UTC(2024, 0, 1),
      Date.UTC(2024, 1, 1),
      Date.UTC(2024, 2, 1),
    ]);
    expect(months[0]!.volume).toBe(310);
    expect(months[1]!.volume).toBe(290); // Feb 2024 has 29 days
    const weeks = aggregate(days, '1D', '1W');
    expect(weeks[0]!.time).toBe(Date.UTC(2024, 0, 1)); // 2024-01-01 is a Monday
    expect(weeks[0]!.volume).toBe(70);
  });

  it('is associative: 1m->15m->1h equals 1m->1h', () => {
    const bars = minuteBars(Date.UTC(2024, 0, 1), 60 * 5 + 17);
    expect(aggregate(aggregate(bars, '1m', '15m'), '15m', '1h')).toEqual(
      aggregate(bars, '1m', '1h'),
    );
  });

  it('rejects non-nesting timeframes', () => {
    expect(canAggregate('2h', '3m')).toBe(false);
    expect(canAggregate('1W', '1M')).toBe(false);
    expect(canAggregate('3m', '1h')).toBe(true);
    expect(canAggregate('1h', '1M')).toBe(true);
    expect(() => aggregate([], '1W', '1M')).toThrow();
  });
});

describe('parseTimeframeInput', () => {
  it.each([
    ['1', '1m'],
    ['5', '5m'],
    ['15m', '15m'],
    ['60', '1h'],
    ['240', '4h'],
    ['4h', '4h'],
    ['4H', '4h'],
    ['D', '1D'],
    ['1d', '1D'],
    ['W', '1W'],
    ['M', '1M'],
    ['1M', '1M'],
  ])('%s -> %s', (input, tf) => expect(parseTimeframeInput(input)).toBe(tf));

  it.each(['7', '45m', '3h', 'x', '', '2D'])('rejects %s', (input) =>
    expect(parseTimeframeInput(input)).toBeNull(),
  );
});
