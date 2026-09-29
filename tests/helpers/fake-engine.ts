import {
  DEFAULT_CHART_OPTIONS,
  getTimeframe,
  computeLayout,
  type ChartEngine,
  type Theme,
  type Timer,
} from '@/lib/core';
import { symbolInfo } from '@/lib/data';
import { darkTheme } from '@/lib/themes';
import { fakeContext } from './fake-context';

/** Minimal ChartEngine stand-in for services that only need its plugin/getter surface. */
export function fakeEngine(): ChartEngine & { currentTheme: Theme } {
  const dc = fakeContext();
  const engine = {
    currentTheme: darkTheme,
    coords: dc.coords,
    seriesData: dc.data,
    addRenderer: () => () => undefined,
    addInteractionHandler: () => () => undefined,
    addPriceRangeContributor: () => () => undefined,
    setCrosshairSnapper: () => undefined,
    invalidate: () => undefined,
    getOptions: () => DEFAULT_CHART_OPTIONS,
    getSymbol: () => symbolInfo('BTCUSDT'),
    getTimeframe: () => getTimeframe('1h'),
    getTheme: () => engine.currentTheme,
    setTheme: (t: Theme) => void (engine.currentTheme = t),
    getLayout: () => computeLayout(2000, 700, 60, null),
    measureText: (t: string) => t.length * 6,
  };
  return engine as unknown as ChartEngine & { currentTheme: Theme };
}

/** Timer whose timeouts only run when flushed. */
export class ManualTimer implements Timer {
  private seq = 0;
  private pending = new Map<number, () => void>();
  setTimeout = (cb: () => void) => {
    this.pending.set(++this.seq, cb);
    return this.seq;
  };
  clearTimeout = (h: number) => void this.pending.delete(h);
  setInterval = () => ++this.seq;
  clearInterval = () => undefined;
  runAll(): void {
    const cbs = [...this.pending.values()];
    this.pending.clear();
    cbs.forEach((cb) => cb());
  }
}
