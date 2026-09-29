import { describe, expect, it, vi } from 'vitest';
import { RangeMinMax, SeriesData, TimeIndex, type Candle } from '@/lib/core';

const bar = (i: number, base = 100): Candle => ({
  time: i * 60_000,
  open: base + i,
  high: base + i + 5 + (i % 7),
  low: base + i - 5 - (i % 5),
  close: base + i + 1,
  volume: 10 + (i % 13),
});

const bars = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, k) => bar(from + k));

describe('SeriesData', () => {
  it('stores columns and grows on append', () => {
    const s = SeriesData.fromCandles(bars(0, 10));
    for (let i = 10; i < 500; i++) s.upsertLast(bar(i));
    expect(s.length).toBe(500);
    expect(s.close[499]).toBe(bar(499).close);
    expect(s.time.length).toBeGreaterThanOrEqual(500);
  });

  it('replaces the last bar with the same time (forming candle)', () => {
    const s = SeriesData.fromCandles(bars(0, 3));
    s.upsertLast({ ...bar(2), close: 999 });
    expect(s.length).toBe(3);
    expect(s.close[2]).toBe(999);
  });

  it('prepends history and notifies listeners', () => {
    const s = SeriesData.fromCandles(bars(10, 20));
    const fn = vi.fn();
    s.onChange(fn);
    s.prepend(bars(0, 10));
    expect(s.length).toBe(20);
    expect(s.time[0]).toBe(0);
    expect(s.time[10]).toBe(bar(10).time);
    expect(fn).toHaveBeenCalledWith({ kind: 'prepend', count: 10 });
  });
});

describe('RangeMinMax', () => {
  it('matches a brute-force scan for arbitrary ranges, incl. after updates', () => {
    const s = SeriesData.fromCandles(bars(0, 1000));
    const idx = new RangeMinMax(s);
    const brute = (a: number, b: number) => {
      let min = Infinity;
      let max = -Infinity;
      for (let i = a; i <= b; i++) {
        min = Math.min(min, s.low[i]!);
        max = Math.max(max, s.high[i]!);
      }
      return { min, max };
    };
    for (const [a, b] of [
      [0, 999],
      [3, 17],
      [60, 200],
      [63, 64],
      [500, 500],
      [128, 191],
    ] as const) {
      expect(idx.priceRange(a, b)).toEqual(brute(a, b));
    }
    s.upsertLast({ ...bar(999), high: 1e6 });
    expect(idx.priceRange(900, 999)!.max).toBe(1e6);
    s.upsertLast({ ...bar(1000), low: -5 });
    expect(idx.priceRange(0, 1000)!.min).toBe(-5);
    expect(idx.volumeMax(0, 1000)).toBe(22);
  });
});

describe('TimeIndex (time <-> fractional index)', () => {
  const s = SeriesData.fromCandles([
    { ...bar(0), time: 0 },
    { ...bar(1), time: 60_000 },
    { ...bar(2), time: 180_000 }, // gap
  ]);
  const ti = new TimeIndex(
    () => s,
    () => 60_000,
  );

  it('maps bar times to integer indices', () => {
    expect(ti.timeToIndex(0)).toBe(0);
    expect(ti.timeToIndex(60_000)).toBe(1);
    expect(ti.timeToIndex(180_000)).toBe(2);
  });

  it('interpolates inside gaps and extrapolates beyond the data', () => {
    expect(ti.timeToIndex(120_000)).toBeCloseTo(1.5, 10);
    expect(ti.timeToIndex(300_000)).toBeCloseTo(4, 10);
    expect(ti.timeToIndex(-120_000)).toBeCloseTo(-2, 10);
  });

  it('round-trips', () => {
    for (const t of [-500_000, 0, 30_000, 150_000, 999_000])
      expect(ti.indexToTime(ti.timeToIndex(t))).toBeCloseTo(t, 6);
  });
});
