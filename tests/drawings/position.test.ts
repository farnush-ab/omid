import { describe, expect, it } from 'vitest';
import { SeriesData, type Candle } from '@/lib/core';
import { drawingRegistry, evaluatePosition, pnlOf, positionStats } from '@/lib/drawings';
import { at, fakeContext } from '../helpers/fake-context';

const H = 3_600_000;
const bar = (i: number, low: number, high: number, close = (low + high) / 2): Candle => ({
  time: i * H,
  open: close,
  high,
  low,
  close,
  volume: 1,
});
const series = (bars: Candle[]) => SeriesData.fromCandles(bars);

const risk = {
  accountSize: 10_000,
  riskMode: 'percent' as const,
  risk: 1,
  lotSize: 1,
  leverage: 1,
  tickSize: 0.01,
  qtyStep: 0.001,
};

describe('positionStats', () => {
  it('sizes by risk and computes R:R, ticks, % and P&L (long)', () => {
    const s = positionStats({ side: 'long', entry: 100, target: 110, stop: 95 }, risk);
    expect(s.riskAmount).toBe(100);
    expect(s.quantity).toBe(20);
    expect(s.riskReward).toBe(2);
    expect(s.targetTicks).toBe(1000);
    expect(s.stopTicks).toBe(500);
    expect(s.targetPercent).toBeCloseTo(10);
    expect(s.stopPercent).toBeCloseTo(5);
    expect(s.targetPnl).toBe(200);
    expect(s.stopPnl).toBe(-100);
  });

  it('mirrors for shorts', () => {
    const s = positionStats({ side: 'short', entry: 100, target: 90, stop: 105 }, risk);
    expect(s.quantity).toBe(20);
    expect(s.riskReward).toBe(2);
    expect(pnlOf('short', 100, 90, s.quantity)).toBe(200);
    expect(pnlOf('short', 100, 105, s.quantity)).toBe(-100);
  });

  it('supports amount risk, lot size, qty step and leverage caps', () => {
    const s = positionStats(
      { side: 'long', entry: 100, target: 101, stop: 99.7 },
      { ...risk, riskMode: 'amount', risk: 50, lotSize: 10, qtyStep: 1 },
    );
    expect(s.quantity).toBe(100); // capped at account/entry (10_000 / 100) before rounding
    expect(s.lots).toBe(10);
    const lev = positionStats(
      { side: 'long', entry: 100, target: 101, stop: 99.7 },
      { ...risk, riskMode: 'amount', risk: 50, leverage: 10, qtyStep: 1 },
    );
    expect(lev.quantity).toBe(166); // 50 / 0.3 = 166.67 rounded down
    expect(lev.margin).toBeCloseTo(1660);
  });
});

describe('evaluatePosition', () => {
  const long = { side: 'long' as const, entry: 100, target: 110, stop: 95 };
  const short = { side: 'short' as const, entry: 100, target: 90, stop: 105 };

  it('waits until price reaches the entry', () => {
    const o = evaluatePosition(series([bar(0, 101, 104), bar(1, 102, 106)]), long, 0, 10 * H);
    expect(o.status).toBe('waiting');
  });

  it('is open with live P&L after entry', () => {
    const o = evaluatePosition(series([bar(0, 99, 101), bar(1, 100, 104, 103)]), long, 0, 10 * H);
    expect(o.status).toBe('open');
    expect(o.entryIndex).toBe(0);
    expect(o.pnlPerUnit).toBe(3);
  });

  it('wins when the target is reached', () => {
    const o = evaluatePosition(series([bar(0, 99, 101), bar(1, 100, 111)]), long, 0, 10 * H);
    expect(o).toMatchObject({ status: 'win', exitIndex: 1, exitPrice: 110, pnlPerUnit: 10 });
  });

  it('loses when the stop is reached', () => {
    const o = evaluatePosition(series([bar(0, 99, 101), bar(1, 94, 100)]), long, 0, 10 * H);
    expect(o).toMatchObject({ status: 'loss', exitPrice: 95, pnlPerUnit: -5 });
  });

  it('assumes the STOP first when one bar touches both (conservative rule)', () => {
    const o = evaluatePosition(series([bar(0, 99, 101), bar(1, 90, 120)]), long, 0, 10 * H);
    expect(o.status).toBe('loss');
    const s = evaluatePosition(series([bar(0, 99, 101), bar(1, 80, 120)]), short, 0, 10 * H);
    expect(s.status).toBe('loss');
  });

  it('on the entry bar only the stop is checked', () => {
    const win = evaluatePosition(series([bar(0, 99, 115)]), long, 0, 10 * H);
    expect(win.status).toBe('open');
    const loss = evaluatePosition(series([bar(0, 94, 101)]), long, 0, 10 * H);
    expect(loss.status).toBe('loss');
  });

  it('mirrors for shorts', () => {
    expect(
      evaluatePosition(series([bar(0, 99, 101), bar(1, 89, 100)]), short, 0, 10 * H).status,
    ).toBe('win');
    expect(
      evaluatePosition(series([bar(0, 99, 101), bar(1, 99, 106)]), short, 0, 10 * H).status,
    ).toBe('loss');
  });

  it('closes at the window end when neither level was hit', () => {
    const o = evaluatePosition(
      series([bar(0, 99, 101), bar(1, 100, 102, 101.5), bar(2, 100, 120)]),
      long,
      0,
      1 * H,
    );
    expect(o).toMatchObject({ status: 'closed', exitIndex: 1, exitPrice: 101.5 });
  });

  it('ignores bars before the start and never sees bars it is not given (replay)', () => {
    const bars = [bar(0, 90, 130), bar(1, 99, 101), bar(2, 100, 111)];
    expect(evaluatePosition(series(bars), long, 1 * H, 10 * H).status).toBe('win');
    expect(evaluatePosition(series(bars.slice(0, 2)), long, 1 * H, 10 * H).status).toBe('open');
  });
});

describe('position tools', () => {
  const dc = fakeContext();

  for (const id of ['long-position', 'short-position'] as const) {
    it(`${id}: single click places entry with target/stop on the correct side`, () => {
      const def = drawingRegistry.require(id);
      const pts = def.finalizePoints!([at(300, 300)], dc);
      const [e, t, s] = pts;
      const up = id === 'long-position' ? 1 : -1;
      expect(up * (t!.price - e!.price)).toBeGreaterThan(0);
      expect(up * (e!.price - s!.price)).toBeGreaterThan(0);
      expect(t!.time).toBe(s!.time);
      expect(t!.time).toBeGreaterThan(e!.time);
    });

    it(`${id}: handles keep levels valid and on the tick grid`, () => {
      const def = drawingRegistry.require(id);
      const d = def.create({
        id: 'p',
        points: def.finalizePoints!([at(300, 300)], dc),
        style: { ...def.defaults },
      });
      const entry = d.points[0]!.price;
      // Drag target across the entry: it must stay one tick on the profit side.
      d.moveAnchor(1, { time: 0, price: id === 'long-position' ? entry - 50 : entry + 50 }, dc, {
        shift: false,
      });
      const t = d.points[1]!.price;
      expect(id === 'long-position' ? t > entry : t < entry).toBe(true);
      expect(Math.abs(t * 100 - Math.round(t * 100))).toBeLessThan(1e-6);
    });

    it(`${id}: derived fields map ticks/%/price back to points`, () => {
      const def = drawingRegistry.require(id);
      const d = def.create({
        id: 'p',
        points: def.finalizePoints!([at(300, 300)], dc),
        style: { ...def.defaults },
      });
      const snap = d.serialize();
      const next = def.derivedFields!.set(snap, 'profitTicks', 500, dc.symbol);
      const got = def.derivedFields!.get(next, dc.symbol);
      expect(got.profitTicks).toBe(500);
      expect(Math.abs(Number(got.profitPrice) - Number(got.entryPrice))).toBeCloseTo(5, 6);
      const moved = def.derivedFields!.set(
        next,
        'entryPrice',
        Number(got.entryPrice) + 10,
        dc.symbol,
      );
      expect(def.derivedFields!.get(moved, dc.symbol).profitTicks).toBe(500);
    });
  }
});
