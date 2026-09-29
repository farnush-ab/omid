import { describe, expect, it } from 'vitest';
import { schemaFields, validateSchema } from '@/lib/core';
import {
  deserializeDrawing,
  drawingRegistry,
  type AnyToolDefinition,
  type ChartPoint,
} from '@/lib/drawings';
import { at, fakeContext, mockCanvas } from '../helpers/fake-context';

/** Sample placement points for a tool, in the fake pixel space. */
function samplePoints(def: AnyToolDefinition): ChartPoint[] {
  const dc = fakeContext();
  const spec = def.placement;
  let pts: ChartPoint[];
  switch (spec.kind) {
    case 'points':
      pts = [at(300, 400), at(700, 200), at(500, 150), at(800, 450)].slice(0, spec.count);
      break;
    case 'polyline':
      pts = [at(300, 400), at(500, 250), at(700, 350)];
      break;
    case 'freehand':
      pts = Array.from({ length: 12 }, (_, i) => at(300 + i * 20, 300 + Math.sin(i) * 30));
      break;
    case 'single':
      pts = [at(500, 300)];
  }
  return def.finalizePoints ? def.finalizePoints(pts, dc) : pts;
}

const tools = drawingRegistry.list();

describe('drawing registry', () => {
  it('registers tools with unique ids and shortcuts', () => {
    expect(tools.length).toBeGreaterThan(0);
    const shortcuts = tools.map((t) => t.shortcut).filter(Boolean);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });
});

describe.each(tools.map((t) => [t.id, t] as const))('drawing contract: %s', (_id, def) => {
  const dc = fakeContext();
  const make = () =>
    def.create({ id: 'd1', points: samplePoints(def), style: { ...def.defaults } });

  it('has a valid settings schema, toolbar and defaults', () => {
    expect(validateSchema(def.settings, def.defaults)).toEqual([]);
    expect(def.styleSchema.safeParse(def.defaults).success).toBe(true);
    const keys = new Set(schemaFields(def.settings).map((f) => f.key));
    for (const k of def.toolbar) expect(keys.has(k)).toBe(true);
    expect(def.icon.length).toBeGreaterThan(0);
  });

  it('round-trips through serialize/deserialize', () => {
    const d = make();
    const snap = d.serialize();
    const back = deserializeDrawing(JSON.parse(JSON.stringify(snap)), drawingRegistry);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.drawing.serialize()).toEqual(snap);
  });

  it('fills missing style keys from defaults and rejects bad styles', () => {
    const snap = make().serialize();
    const firstKey = Object.keys(def.defaults)[0]!;
    const partial = {
      ...snap,
      style: Object.fromEntries(Object.entries(snap.style).filter(([k]) => k !== firstKey)),
    };
    const res = deserializeDrawing(partial, drawingRegistry);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.drawing.style[firstKey]).toEqual(def.defaults[firstKey]);
    expect(
      deserializeDrawing({ ...snap, points: [{ time: 'x', price: 1 }] }, drawingRegistry).ok,
    ).toBe(false);
    expect(deserializeDrawing({ ...snap, type: 'nope' }, drawingRegistry).ok).toBe(false);
  });

  it('exposes anchors that hit-test as anchors', () => {
    const d = make();
    const anchors = d.getAnchors(dc);
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
      expect(d.hitTest(a.x, a.y, dc)?.part).toBe('anchor');
    }
  });

  it('hit-tests its body and misses far away', () => {
    const d = make();
    expect(d.hitTest(1900, 20, dc)).toBeNull();
    const b = d.bounds(dc) ?? { x: 250, y: 100, width: 600, height: 400 };
    let bodyHit = false;
    for (let x = b.x; x <= b.x + b.width && !bodyHit; x += 3) {
      for (let y = b.y; y <= b.y + b.height && !bodyHit; y += 3) {
        bodyHit = d.hitTest(x, y, dc)?.part === 'body';
      }
    }
    expect(bodyHit).toBe(true);
  });

  it('moves anchors in chart space', () => {
    const d = make();
    const before = JSON.stringify(d.points);
    d.moveAnchor(0, at(100, 100), dc, { shift: false });
    expect(JSON.stringify(d.points)).not.toBe(before);
    expect(d.points.every((p) => Number.isFinite(p.time) && Number.isFinite(p.price))).toBe(true);
  });

  it('renders in every state without throwing', () => {
    const d = make();
    const ctx = mockCanvas();
    for (const state of [
      { hovered: false, selected: false, placing: false },
      { hovered: true, selected: true, placing: false },
      { hovered: false, selected: true, placing: true },
    ]) {
      expect(() => d.render(ctx, dc, state)).not.toThrow();
    }
  });

  it('reports a price range covering its points', () => {
    const d = make();
    const r = d.priceRange?.();
    if (!r) return;
    for (const p of d.points) {
      expect(p.price).toBeGreaterThanOrEqual(r.min - 1e-9);
      expect(p.price).toBeLessThanOrEqual(r.max + 1e-9);
    }
  });
});
