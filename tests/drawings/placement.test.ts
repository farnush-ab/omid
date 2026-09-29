import { describe, expect, it } from 'vitest';
import { PlacementSession, drawingRegistry, snapPrice } from '@/lib/drawings';
import { at, fakeContext } from '../helpers/fake-context';

const dc = fakeContext();

describe('PlacementSession', () => {
  it('two-point tools: click-click with live preview', () => {
    const def = drawingRegistry.require('trend-line');
    const s = new PlacementSession(def, 'x', { ...def.defaults }, at(100, 100), () => dc);
    s.move(at(300, 200));
    expect(s.drawing.points).toHaveLength(2);
    expect(s.drawing.points[1]).toEqual(at(300, 200));
    expect(s.canFinish()).toBe(false);
    expect(s.click(at(400, 250))).toBe('done');
    expect(s.finish().points).toEqual([at(100, 100), at(400, 250)]);
  });

  it('two-point tools: press-drag-release', () => {
    const def = drawingRegistry.require('rectangle');
    const s = new PlacementSession(def, 'x', { ...def.defaults }, at(100, 100), () => dc);
    expect(s.dragRelease(at(200, 300))).toBe('done');
  });
});

describe('magnet', () => {
  it('strong snaps to the nearest OHLC value; weak only when close', () => {
    const i = 10;
    const high = dc.data.high[i]!;
    expect(snapPrice(i, high + 1, 'strong', dc)).toBe(high);
    expect(snapPrice(i, high + 1, 'weak', dc)).toBe(high);
    expect(snapPrice(i, high + 100, 'weak', dc)).toBe(high + 100);
    expect(snapPrice(i, high + 100, 'strong', dc)).toBe(high);
    expect(snapPrice(i, 123, 'off', dc)).toBe(123);
  });
});
