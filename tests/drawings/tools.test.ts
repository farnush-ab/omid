import { describe, expect, it } from 'vitest';
import { PlacementSession, drawingRegistry, toPixel } from '@/lib/drawings';
import { at, fakeContext } from '../helpers/fake-context';

const dc = fakeContext();
const create = (type: string, points = [at(100, 300), at(300, 100), at(500, 300)]) => {
  const def = drawingRegistry.require(type);
  return def.create({ id: 'x', points, style: { ...def.defaults } });
};

describe('Path', () => {
  it('inserts a point on the nearest segment and removes points down to two', () => {
    const d = create('path');
    expect(d.insertPointAt!(200, 200, dc)).toBe(true);
    expect(d.points).toHaveLength(4);
    expect(toPixel(d.points[1]!, dc).x).toBeCloseTo(200, 6);
    expect(d.removePoint!(1)).toBe(true);
    expect(d.removePoint!(0)).toBe(true);
    expect(d.removePoint!(0)).toBe(false);
    expect(d.points).toHaveLength(2);
  });

  it('polyline placement needs the minimum points and finishes on demand', () => {
    const def = drawingRegistry.require('path');
    const s = new PlacementSession(def, 'p', { ...def.defaults }, at(0, 0), () => dc);
    expect(s.canFinish()).toBe(false);
    s.click(at(100, 100));
    expect(s.canFinish()).toBe(true);
    s.click(at(200, 50));
    expect(s.finish().points).toHaveLength(3);
  });
});

describe('Curve', () => {
  it('adds an on-curve handle when placed with two points', () => {
    const def = drawingRegistry.require('curve');
    const pts = def.finalizePoints!([at(100, 300), at(300, 300)], dc);
    expect(pts).toHaveLength(3);
    const h = toPixel(pts[2]!, dc);
    expect(h.x).toBeCloseTo(200, 6);
    expect(h.y).not.toBeCloseTo(300, 0);
  });

  it('passes through its handle (hit-test at the handle position is on the body or anchor)', () => {
    const def = drawingRegistry.require('curve');
    const d = def.create({
      id: 'c',
      points: def.finalizePoints!([at(100, 300), at(300, 300)], dc),
      style: { ...def.defaults },
    });
    const h = toPixel(d.points[2]!, dc);
    expect(d.hitTest(h.x, h.y + 3, dc)).not.toBeNull();
  });
});

describe('Text', () => {
  it('resizes its box width via the edge handle and enables wrapping', () => {
    const d = create('text', [at(100, 100)]);
    const edge = d.getAnchors(dc).find((a) => a.index === 1)!;
    d.moveAnchor(1, at(edge.x + 150, edge.y), dc, { shift: false });
    expect(d.style.wrap).toBe(true);
    expect(Number(d.style.boxWidth)).toBeGreaterThan(150);
    expect(d.textRect!(dc)!.width).toBeCloseTo(Number(d.style.boxWidth), 6);
  });

  it('hit-tests inside a rotated box', () => {
    const d = create('text', [at(100, 100)]);
    d.style = { ...d.style, text: 'A long line of text', rotation: 90 };
    expect(d.hitTest(95, 140, dc)?.part).toBe('body');
    expect(d.hitTest(160, 95, dc)).toBeNull();
  });
});

describe('Highlighter', () => {
  it('stores its samples in chart space and only exposes end handles', () => {
    const pts = Array.from({ length: 20 }, (_, i) => at(100 + i * 10, 200));
    const d = create('highlighter', pts);
    expect(d.getAnchors(dc).map((a) => a.index)).toEqual([0, 19]);
    expect(d.hitTest(150, 205, dc)?.part).toBe('body');
  });
});
