import { SeriesData, type ChartCoordinates, type Candle } from '@/lib/core';
import type { DrawingContext } from '@/lib/drawings';
import { symbolInfo } from '@/lib/data';
import { darkTheme } from '@/lib/themes';
import { getTimeframe } from '@/lib/core';

export const T0 = Date.UTC(2024, 0, 1);
export const STEP = 3_600_000;
export const BAR_PX = 10;

/** 200 hourly bars around price 100..300, linear coordinates: x = index*10, y = 600 - price*2. */
export function fakeContext(): DrawingContext {
  const bars: Candle[] = Array.from({ length: 200 }, (_, i) => {
    const base = 200 + Math.sin(i / 10) * 50;
    return {
      time: T0 + i * STEP,
      open: base,
      high: base + 5,
      low: base - 5,
      close: base + 2,
      volume: 10,
    };
  });
  const data = SeriesData.fromCandles(bars);
  const coords: ChartCoordinates = {
    barSpacing: BAR_PX,
    pricePane: { x: 0, y: 0, width: 2000, height: 600 },
    plot: { x: 0, y: 0, width: 2000, height: 700 },
    timeToIndex: (t) => (t - T0) / STEP,
    indexToTime: (i) => T0 + i * STEP,
    indexToX: (i) => i * BAR_PX,
    xToIndex: (x) => x / BAR_PX,
    timeToX: (t) => ((t - T0) / STEP) * BAR_PX,
    xToTime: (x) => T0 + (x / BAR_PX) * STEP,
    priceToY: (p) => 600 - p * 2,
    yToPrice: (y) => (600 - y) / 2,
  };
  return {
    coords,
    data,
    symbol: symbolInfo('BTCUSDT'),
    timeframe: getTimeframe('1h'),
    theme: darkTheme,
    pane: coords.pricePane,
    dpr: 1,
    formatPrice: (p) => p.toFixed(2),
    measureText: (t) => t.length * 6,
  };
}

/** Chart point at pixel (x, y) in the fake coordinate system. */
export const at = (x: number, y: number) => ({
  time: T0 + (x / BAR_PX) * STEP,
  price: (600 - y) / 2,
});

/** A CanvasRenderingContext2D stand-in that accepts every call. */
export function mockCanvas(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const target: Record<string, unknown> = {
    measureText: (t: string) => ({ width: t.length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getLineDash: () => [],
  };
  return new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : noop),
    set: (t, k: string, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
