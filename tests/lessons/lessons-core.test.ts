import { describe, expect, it } from 'vitest';
import type { Candle } from '@/lib/core';
import { MemoryStorage } from '@/lib/storage';
import {
  CapturingProvider,
  DatasetCollector,
  LessonDataProvider,
  LessonFormatError,
  RecordingClock,
  StorageLessonRepository,
  TimelineIndex,
  TimelineRecorder,
  decodeTimeline,
  encodeTimeline,
  fixWebmDuration,
  lerpRecord,
  readWebmDuration,
  type LessonTimeline,
  type SliceBehaviors,
  type TimelineOp,
} from '@/lib/lessons';

const manualClock = (start = 0) => {
  let now = start;
  return { now: () => now, set: (t: number) => (now = t), add: (d: number) => (now += d) };
};

const behaviors: SliceBehaviors = {
  cursor: { continuous: true, interpolate: lerpRecord },
  list: { reduce: (prev, patch) => [...((prev as number[]) ?? []), patch as number] },
};

function timeline(ops: TimelineOp[], duration: number): LessonTimeline {
  return { version: 1, duration, initial: { a: 0, list: [] }, ops, datasets: [] };
}

describe('RecordingClock', () => {
  it('excludes paused time and is monotonic', () => {
    const c = manualClock(1000);
    const rc = new RecordingClock(c);
    rc.start();
    c.add(500);
    expect(rc.now()).toBe(500);
    rc.pause();
    c.add(10_000);
    expect(rc.now()).toBe(500);
    rc.resume();
    c.add(250);
    expect(rc.now()).toBe(750);
    c.set(0); // wall clock jumped backwards
    expect(rc.now()).toBe(750);
    expect(rc.stop()).toBe(750);
  });
});

describe('TimelineIndex', () => {
  const ops: TimelineOp[] = [];
  for (let i = 0; i < 400; i++) {
    ops.push({ t: i * 37, s: i % 3 === 0 ? 'a' : 'b', v: i });
    if (i % 50 === 0) ops.push({ t: i * 37, s: 'list', v: i, p: 1 });
    if (i % 5 === 0) ops.push({ t: i * 37, s: 'cursor', v: { x: i, y: -i } });
  }
  const tl = timeline(ops, 400 * 37);
  const idx = new TimelineIndex(tl, behaviors, 500);

  it('keyframed state equals the naive fold for discrete slices at any time', () => {
    expect(idx.keyframeCount).toBeGreaterThan(20);
    for (let t = -10; t <= tl.duration + 10; t += 13) {
      const fast = { ...idx.stateAt(t) };
      const naive = { ...idx.stateAtNaive(t) };
      delete fast.cursor;
      delete naive.cursor;
      expect(fast).toEqual(naive);
    }
  });

  it('seeking backwards and forwards gives the same result as linear playback', () => {
    const forward = [0, 1000, 5000, 9000].map((t) => idx.stateAt(t));
    const shuffled = [9000, 0, 5000, 1000].map((t) => [t, idx.stateAt(t)] as const);
    for (const [t, s] of shuffled) expect(s).toEqual(forward[[0, 1000, 5000, 9000].indexOf(t)]);
  });

  it('interpolates continuous slices between samples', () => {
    const s = idx.stateAt(5 * 37 + 37 * 2.5); // halfway between samples 5 and 10
    expect(s.cursor).toEqual({ x: 7.5, y: -7.5 });
    expect(idx.stateAt(0).cursor).toEqual({ x: 0, y: -0 });
  });

  it('does not interpolate across a pause in motion (maxGapMs)', () => {
    const t3 = new TimelineIndex(
      timeline(
        [
          { t: 0, s: 'cursor', v: { x: 0 } },
          { t: 1000, s: 'cursor', v: { x: 100 } },
          { t: 1100, s: 'cursor', v: { x: 110 } },
        ],
        1200,
      ),
      { cursor: { continuous: true, interpolate: lerpRecord, maxGapMs: 250 } },
    );
    expect(t3.stateAt(500).cursor).toEqual({ x: 0 });
    expect(t3.stateAt(1050).cursor).toEqual({ x: 105 });
  });

  it('holds and clears continuous slices around null samples', () => {
    const t2 = new TimelineIndex(
      timeline(
        [
          { t: 100, s: 'cursor', v: { x: 0 } },
          { t: 200, s: 'cursor', v: null },
          { t: 300, s: 'cursor', v: { x: 10 } },
        ],
        400,
      ),
      behaviors,
    );
    expect(t2.stateAt(50).cursor).toBeUndefined();
    expect(t2.stateAt(150).cursor).toEqual({ x: 0 });
    expect(t2.stateAt(250).cursor).toBeNull();
    expect(t2.stateAt(350).cursor).toEqual({ x: 10 });
  });

  it('applies patch ops through reduce', () => {
    expect(idx.stateAt(tl.duration).list).toEqual([0, 50, 100, 150, 200, 250, 300, 350]);
  });

  it('rejects unsorted ops and never mutates the timeline', () => {
    expect(
      () =>
        new TimelineIndex(
          timeline(
            [
              { t: 5, s: 'a', v: 1 },
              { t: 1, s: 'a', v: 2 },
            ],
            5,
          ),
          {},
        ),
    ).toThrow();
    const frozen = JSON.stringify(tl);
    const s = idx.stateAt(3000) as Record<string, unknown>;
    s.a = 'student change';
    expect(JSON.stringify(tl)).toBe(frozen);
    expect(idx.stateAt(3000).a).not.toBe('student change');
  });
});

describe('TimelineRecorder', () => {
  it('dedups discrete values, throttles samples and keeps the final sample', () => {
    const c = manualClock();
    const r = new TimelineRecorder(c, { sampleIntervalMs: 40 });
    r.begin({ a: 1 });
    r.record('a', 1); // same as initial
    c.set(10);
    r.record('a', 2);
    r.record('a', 2);
    for (let t = 10; t <= 30; t += 5) {
      c.set(t);
      r.sample('cursor', { x: t });
    }
    c.set(35);
    r.flush();
    const tl = r.finish(100, []);
    expect(tl.ops).toEqual([
      { t: 10, s: 'a', v: 2 },
      { t: 10, s: 'cursor', v: { x: 10 } },
      { t: 35, s: 'cursor', v: { x: 30 } },
    ]);
    expect(tl.duration).toBe(100);
  });

  it('flushes pending samples before discrete ops so ops stay sorted', () => {
    const c = manualClock();
    const r = new TimelineRecorder(c);
    r.sample('cursor', { x: 0 });
    c.set(5);
    r.sample('cursor', { x: 1 });
    c.set(6);
    r.record('a', 1);
    const ts = r.finish(6, []).ops.map((o) => o.t);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    expect(r.finish(6, []).ops.at(-2)).toEqual({ t: 6, s: 'cursor', v: { x: 1 } });
  });
});

describe('codec', () => {
  it('round-trips through gzip and validates input', async () => {
    const tl = timeline([{ t: 1, s: 'a', v: { deep: [1, 2] } }], 10);
    const bytes = await encodeTimeline(tl);
    expect(bytes[0]).toBe(0x1f);
    expect(await decodeTimeline(bytes)).toEqual(tl);
    await expect(decodeTimeline(new TextEncoder().encode('{"version":1}'))).rejects.toBeInstanceOf(
      LessonFormatError,
    );
  });

  it('keeps a 30-minute cursor-heavy timeline small', async () => {
    const ops: TimelineOp[] = [];
    for (let t = 0; t < 30 * 60_000; t += 50)
      ops.push({ t, s: 'cursor', v: { t: 1.7e12 + t * 60, p: 43000 + Math.sin(t / 900) * 120.5 } });
    const bytes = await encodeTimeline(timeline(ops, 30 * 60_000));
    expect(bytes.byteLength).toBeLessThan(2_000_000);
  });
});

const bars = (from: number, n: number): Candle[] =>
  Array.from({ length: n }, (_, i) => ({
    time: (from + i) * 60_000,
    open: i,
    high: i + 1,
    low: i - 1,
    close: i,
    volume: 1,
  }));

const SYMBOL = {
  symbol: 'BTCUSDT',
  description: 'Bitcoin',
  tickSize: 0.01,
  pricePrecision: 2,
  qtyStep: 0.001,
  quoteCurrency: 'USDT',
  baseCurrency: 'BTC',
};

describe('datasets and providers', () => {
  it('captures bars, merges overlaps and serves them back offline', async () => {
    const collector = new DatasetCollector();
    const inner = {
      id: 'x',
      label: 'x',
      fetchBars: async () => ({ bars: bars(0, 10), source: 'x', hasMoreHistory: true }),
      searchSymbols: () => [SYMBOL],
      getSymbolInfo: () => SYMBOL,
    };
    const cap = new CapturingProvider(inner);
    await cap.fetchBars({ symbol: 'BTCUSDT', timeframe: '1m', limit: 10 }); // not recording
    cap.setSink((s, tf, b) => collector.add(s, tf, b));
    await cap.fetchBars({ symbol: 'BTCUSDT', timeframe: '1m', limit: 10 });
    collector.add(SYMBOL, '1m', bars(5, 10)); // overlapping page
    const [ds] = collector.toDatasets();
    expect(ds!.columns[0]).toHaveLength(15);

    const lp = new LessonDataProvider(collector.toDatasets());
    const latest = await lp.fetchBars({ symbol: 'BTCUSDT', timeframe: '1m', limit: 5 });
    expect(latest.bars.map((b) => b.time / 60_000)).toEqual([10, 11, 12, 13, 14]);
    expect(latest.hasMoreHistory).toBe(true);
    const older = await lp.fetchBars({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      endTime: 3 * 60_000,
      limit: 10,
    });
    expect(older.bars).toHaveLength(4);
    expect(older.hasMoreHistory).toBe(false);
    const fwd = await lp.fetchBars({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      startTime: 12 * 60_000,
      limit: 10,
    });
    expect(fwd.bars).toHaveLength(3);
    expect(lp.getSymbolInfo('BTCUSDT')).toEqual(SYMBOL);
  });
});

describe('StorageLessonRepository', () => {
  it('saves, lists, renames and removes lessons', async () => {
    const repo = new StorageLessonRepository(new MemoryStorage());
    const tl = timeline([{ t: 1, s: 'a', v: 2 }], 1000);
    const audio = new Blob(['voice'], { type: 'audio/webm' });
    const meta = await repo.save(
      { id: 'l1', title: 'First', createdAt: 5, duration: 1000, audioType: 'audio/webm' },
      tl,
      audio,
    );
    expect(meta.bytes).toBeGreaterThan(5);
    await repo.save(
      { id: 'l2', title: 'Second', createdAt: 9, duration: 1, audioType: null },
      tl,
      null,
    );
    expect((await repo.list()).map((m) => m.id)).toEqual(['l2', 'l1']);
    const loaded = await repo.load('l1');
    expect(loaded!.timeline).toEqual(tl);
    expect(await loaded!.audio!.text()).toBe('voice');
    await repo.rename('l1', 'Renamed');
    expect((await repo.load('l1'))!.meta.title).toBe('Renamed');
    await repo.remove('l1');
    expect(await repo.load('l1')).toBeNull();
    expect(await repo.list()).toHaveLength(1);
  });

  it('assembles drafts from appended segments in order', async () => {
    const repo = new StorageLessonRepository(new MemoryStorage());
    await repo.writeDraftHeader({
      id: 'd',
      createdAt: 1,
      audioType: null,
      initial: { a: 0 },
      reached: 50,
    });
    await repo.appendDraftOps('d', 1, [{ t: 20, s: 'a', v: 2 }]);
    await repo.appendDraftOps('d', 0, [{ t: 10, s: 'a', v: 1 }]);
    await repo.appendDraftAudio('d', 0, new Blob(['a']));
    await repo.appendDraftAudio('d', 10, new Blob(['b']));
    await repo.appendDraftAudio('d', 2, new Blob(['c']));
    const draft = await repo.loadDraft('d');
    expect(draft!.ops.map((o) => o.t)).toEqual([10, 20]);
    expect(await new Blob(draft!.audio).text()).toBe('acb');
    expect(await repo.listDrafts()).toHaveLength(1);
    await repo.removeDraft('d');
    expect(await repo.listDrafts()).toHaveLength(0);
    expect(await repo.loadDraft('d')).toBeNull();
  });
});

describe('fixWebmDuration', () => {
  // EBML header, Segment (unknown size), Info { TimecodeScale, MuxingApp }, Cluster stub.
  const webm = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01, 0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0x15, 0x49, 0xa9, 0x66, 0x8b, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42,
    0x40, 0x4d, 0x80, 0x81, 0x41, 0x1f, 0x43, 0xb6, 0x75, 0x81, 0x00,
  ]);

  it('inserts a Duration and then overwrites it in place', () => {
    expect(readWebmDuration(webm)).toBeNull();
    const fixed = fixWebmDuration(webm, 12_345);
    expect(readWebmDuration(fixed)).toBeCloseTo(12_345);
    expect(fixed.length).toBe(webm.length + 11 + 7);
    const again = fixWebmDuration(fixed, 500);
    expect(again.length).toBe(fixed.length);
    expect(readWebmDuration(again)).toBeCloseTo(500);
    // The cluster is untouched at the end.
    expect([...again.slice(-6)]).toEqual([0x1f, 0x43, 0xb6, 0x75, 0x81, 0x00]);
  });

  it('leaves non-WebM input alone', () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]);
    expect(fixWebmDuration(mp4, 10)).toBe(mp4);
  });
});
