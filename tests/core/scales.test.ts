import { describe, expect, it } from 'vitest';
import { PriceScale, TimeScale, generatePriceTicks, niceStep } from '@/lib/core';
import { ViewportController } from '@/lib/core/engine/viewport-controller';

describe('TimeScale (index <-> x)', () => {
  const ts = new TimeScale();
  ts.width = 1000;
  ts.barSpacing = 10;
  ts.rightIndex = 100;

  it('maps the right edge to rightIndex', () => {
    expect(ts.indexToX(100)).toBe(1000);
    expect(ts.indexToX(90)).toBe(900);
  });

  it('round-trips x <-> index', () => {
    for (const x of [0, 13.5, 500, 999]) expect(ts.indexToX(ts.xToIndex(x))).toBeCloseTo(x, 9);
  });

  it('zooms around the anchor keeping the anchored bar fixed', () => {
    const s = new TimeScale();
    s.width = 1000;
    s.barSpacing = 10;
    s.rightIndex = 100;
    const before = s.xToIndex(400);
    s.zoomAt(400, 2);
    expect(s.barSpacing).toBe(20);
    expect(s.xToIndex(400)).toBeCloseTo(before, 9);
  });

  it('clamps so some data stays visible', () => {
    const s = new TimeScale();
    s.width = 1000;
    s.barSpacing = 10;
    s.rightIndex = -500;
    s.clamp(1000);
    expect(s.rightIndex).toBeGreaterThan(0);
    s.rightIndex = 1e6;
    s.clamp(1000);
    expect(s.leftIndex).toBeLessThan(1000);
  });

  it('reports the visible integer range', () => {
    expect(ts.visibleRange(95)).toEqual({ from: 0, to: 94 });
  });
});

function scale(mode: 'linear' | 'log' | 'percent', inverted = false): PriceScale {
  const s = new PriceScale();
  s.mode = mode;
  s.inverted = inverted;
  s.top = 0;
  s.height = 500;
  s.base = 100;
  s.fitPrices(50, 200);
  return s;
}

describe('PriceScale (price <-> y)', () => {
  for (const mode of ['linear', 'log', 'percent'] as const) {
    for (const inverted of [false, true]) {
      it(`round-trips in ${mode} mode${inverted ? ' (inverted)' : ''}`, () => {
        const s = scale(mode, inverted);
        for (const p of [50, 73.21, 100, 150, 200])
          expect(s.yToPrice(s.priceToY(p))).toBeCloseTo(p, 8);
      });
    }
  }

  it('puts higher prices higher on screen (and lower when inverted)', () => {
    const s = scale('linear');
    expect(s.priceToY(200)).toBeLessThan(s.priceToY(50));
    const inv = scale('linear', true);
    expect(inv.priceToY(200)).toBeGreaterThan(inv.priceToY(50));
  });

  it('respects margins: fitted extremes sit at the margin lines', () => {
    const s = scale('linear');
    expect(s.priceToY(200)).toBeCloseTo(500 * s.marginTop, 6);
    expect(s.priceToY(50)).toBeCloseTo(500 * (1 - s.marginBottom), 6);
  });

  it('log mode spaces equal ratios equally', () => {
    const s = scale('log');
    const d1 = s.priceToY(50) - s.priceToY(100);
    const d2 = s.priceToY(100) - s.priceToY(200);
    expect(d1).toBeCloseTo(d2, 8);
  });

  it('percent mode is relative to the base', () => {
    const s = scale('percent');
    expect(s.toLogical(110)).toBeCloseTo(10, 10);
    expect(s.fromLogical(-50)).toBeCloseTo(50, 10);
  });

  it('keeps visible prices when switching mode', () => {
    const s = scale('linear');
    const y = s.priceToY(120);
    s.setMode('log');
    expect(s.yToPrice(0 + 500 * s.marginTop)).toBeCloseTo(200, 6);
    expect(Number.isFinite(y)).toBe(true);
  });

  it('manual scroll moves the range', () => {
    const s = scale('linear');
    const before = s.yToPrice(250);
    s.scrollBy(50);
    expect(s.yToPrice(250)).toBeGreaterThan(before);
  });
});

describe('price ticks', () => {
  it('produces nice steps', () => {
    expect(niceStep(0.13)).toBe(0.2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(430)).toBe(500);
  });

  it('generates evenly spaced, increasing ticks in all modes', () => {
    for (const mode of ['linear', 'log', 'percent'] as const) {
      const s = scale(mode);
      const ticks = generatePriceTicks(s, 40, (p) => p.toFixed(2));
      expect(ticks.length).toBeGreaterThan(3);
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i]!.price).toBeGreaterThan(ticks[i - 1]!.price);
        expect(Math.abs(ticks[i]!.y - ticks[i - 1]!.y)).toBeGreaterThanOrEqual(39);
      }
    }
  });
});

describe('ViewportController drag-pan', () => {
  const setup = (inverted: boolean) => {
    const vp = new ViewportController({ now: () => 0 });
    vp.setDataLength(100);
    vp.price.height = 500;
    vp.price.min = 100;
    vp.price.max = 200;
    vp.price.autoScale = false;
    vp.price.inverted = inverted;
    return vp;
  };

  it.each([false, true])('content follows the pointer vertically (inverted=%s)', (inverted) => {
    const vp = setup(inverted);
    const before = vp.price.priceToY(150);
    vp.panBy(0, 40); // drag down by 40px
    expect(vp.price.priceToY(150)).toBeCloseTo(before + 40, 6);
    vp.panBy(0, -70); // drag up by 70px
    expect(vp.price.priceToY(150)).toBeCloseTo(before - 30, 6);
  });

  it('does not move vertically while auto-scale is on', () => {
    const vp = setup(false);
    vp.price.autoScale = true;
    vp.panBy(0, 40);
    expect([vp.price.min, vp.price.max]).toEqual([100, 200]);
  });
});
