import { describe, expect, it, vi } from 'vitest';
import {
  SeriesData,
  aggregate,
  createRng,
  type Candle,
  type Timer,
  type TimeframeId,
} from '@/lib/core';
import { SyntheticProvider } from '@/lib/data';
import {
  REPLAY_STATES,
  ReplayController,
  ReplaySession,
  resolveBaseTimeframe,
  transition,
  type ReplayEvent,
  type ReplayHost,
} from '@/lib/replay';

const NOW = Date.UTC(2026, 8, 29, 12);
const provider = new SyntheticProvider({ clock: { now: () => NOW } });
const bars = (tf: TimeframeId, limit: number) =>
  provider.generate({ symbol: 'BTCUSDT', timeframe: tf, limit }).bars;

describe('replay state machine', () => {
  it('follows idle → selecting → paused ↔ playing → exited → idle', () => {
    let s = transition('idle', 'START')!;
    expect(s).toBe('selecting');
    s = transition(s, 'SELECT')!;
    expect(s).toBe('paused');
    s = transition(s, 'PLAY')!;
    expect(s).toBe('playing');
    expect(transition(s, 'TICK')).toBe('playing');
    expect(transition(s, 'REACHED_END')).toBe('paused');
    s = transition(s, 'PAUSE')!;
    s = transition(s, 'EXIT')!;
    expect(s).toBe('exited');
    expect(transition(s, 'RESET')).toBe('idle');
  });

  it('rejects invalid transitions', () => {
    const invalid: Array<[Parameters<typeof transition>[0], ReplayEvent]> = [
      ['idle', 'PLAY'],
      ['idle', 'STEP'],
      ['selecting', 'PLAY'],
      ['paused', 'SELECT'],
      ['exited', 'PLAY'],
    ];
    for (const [s, e] of invalid) expect(transition(s, e)).toBeNull();
  });

  it('every state can be left', () => {
    const events: ReplayEvent[] = [
      'START',
      'CANCEL',
      'SELECT',
      'PLAY',
      'PAUSE',
      'STEP',
      'TICK',
      'REACHED_END',
      'JUMP_END',
      'RESELECT',
      'EXIT',
      'RESET',
    ];
    for (const s of REPLAY_STATES)
      expect(events.some((e) => (transition(s, e) ?? s) !== s)).toBe(true);
  });
});

describe('ReplaySession', () => {
  const full1h = SeriesData.fromCandles(bars('1h', 500));

  it('hides everything after the selected bar and reveals one bar per step', () => {
    const s = ReplaySession.start(full1h, '1h', 300);
    expect(s.revealed.length).toBe(301);
    expect(s.revealed.time[300]).toBe(full1h.time[300]);
    expect(s.step()).toBe('stepped');
    expect(s.revealed.length).toBe(302);
    expect(s.revealed.bar(301)).toEqual(full1h.bar(301));
  });

  it('never exposes bars at or after the cursor (no future leak)', () => {
    const s = ReplaySession.start(full1h, '1h', 100);
    for (let i = 0; i < 25; i++) s.step();
    const last = s.revealed.time[s.revealed.lastIndex]!;
    expect(last).toBeLessThan(s.cursor);
    expect(s.revealed.length).toBe(126);
  });

  it('reaches the end and reports it', () => {
    const s = ReplaySession.start(full1h, '1h', 497);
    expect(s.step()).toBe('stepped');
    expect(s.step()).toBe('stepped');
    expect(s.step()).toBe('end');
    expect(s.atEnd).toBe(true);
  });

  it('switching to a higher timeframe keeps replay time and builds the forming candle from base bars', () => {
    const s = ReplaySession.start(full1h, '1h', 301); // cursor mid 4h-bucket in general
    for (let i = 0; i < 2; i++) s.step();
    const cursor = s.cursor;
    const full4h = SeriesData.fromCandles(aggregate(full1h.toCandles(), '1h', '4h'));
    const from = ReplaySession.partialFrom(cursor, '4h');
    const base = full1h.toCandles().filter((b) => b.time >= (from ?? cursor));
    s.rebase(full4h, '4h', resolveBaseTimeframe('1h', '4h'), base, true);
    expect(s.cursor).toBe(cursor);
    expect(s.baseTimeframe).toBe('1h');
    const expected = aggregate(
      full1h.toCandles().filter((b) => b.time < cursor),
      '1h',
      '4h',
    );
    expect(s.revealed.toCandles()).toEqual(expected);
    // Stepping adds one hour to the forming 4h candle until it completes.
    s.step();
    const expected2 = aggregate(
      full1h.toCandles().filter((b) => b.time < s.cursor),
      '1h',
      '4h',
    );
    expect(s.revealed.toCandles()).toEqual(expected2);
  });

  it('switching to a lower timeframe steps at the lower resolution', () => {
    expect(resolveBaseTimeframe('4h', '15m')).toBe('15m');
    expect(resolveBaseTimeframe('1h', '1D')).toBe('1h');
    expect(resolveBaseTimeframe('1W', '1M')).toBe('1D');
  });

  it('asks for data when the base buffer is empty', () => {
    const s = ReplaySession.start(full1h, '1h', 301);
    const full4h = SeriesData.fromCandles(aggregate(full1h.toCandles(), '1h', '4h'));
    s.rebase(full4h, '4h', '1h', [], false);
    expect(s.step()).toBe('need-data');
  });

  it('jumpToEnd reveals all loaded bars', () => {
    const s = ReplaySession.start(full1h, '1h', 10);
    s.jumpToEnd();
    expect(s.revealed.length).toBe(full1h.length);
    expect(s.atEnd).toBe(true);
  });
});

class FakeTimer implements Timer {
  private seq = 0;
  intervals = new Map<number, { cb: () => void; ms: number }>();
  setTimeout = () => ++this.seq;
  clearTimeout = () => undefined;
  setInterval = (cb: () => void, ms: number) => {
    this.intervals.set(++this.seq, { cb, ms });
    return this.seq;
  };
  clearInterval = (h: number) => void this.intervals.delete(h);
  tick(): void {
    for (const { cb } of [...this.intervals.values()]) cb();
  }
}

function fakeEngine() {
  const engine = {
    data: new SeriesData(),
    addInteractionHandler: vi.fn(() => () => undefined),
    addRenderer: vi.fn(() => () => undefined),
    invalidate: vi.fn(),
    setData: vi.fn((d: SeriesData) => (engine.data = d)),
    scrollToLatest: vi.fn(),
    get seriesData() {
      return engine.data;
    },
  };
  return engine;
}

describe('ReplayController', () => {
  function setup() {
    const timer = new FakeTimer();
    const engine = fakeEngine();
    let tf: TimeframeId = '1h';
    let full = SeriesData.fromCandles(bars('1h', 300));
    const all1h: Candle[] = bars('1h', 300);
    const override = vi.fn();
    const host: ReplayHost = {
      fullData: () => full,
      timeframe: () => tf,
      loadTimeframe: async (next) => {
        tf = next;
        full = SeriesData.fromCandles(aggregate(all1h, '1h', next));
        return true;
      },
      fetchForward: async (_tf, start, limit) =>
        all1h.filter((b) => b.time >= start).slice(0, limit),
      setDisplayOverride: override,
    };
    const ctrl = new ReplayController(engine as never, host, timer, createRng(7));
    return { ctrl, timer, engine, override };
  }

  it('selects a bar, overrides the display, plays on timer ticks and stops at the end', async () => {
    const { ctrl, timer, engine, override } = setup();
    ctrl.startSelecting();
    expect(ctrl.state).toBe('selecting');
    await ctrl.selectBar(295);
    expect(ctrl.state).toBe('paused');
    expect(override).toHaveBeenLastCalledWith(true);
    expect(engine.data.length).toBe(296);
    ctrl.setSpeed(10);
    ctrl.play();
    expect([...timer.intervals.values()][0]!.ms).toBe(100);
    for (let i = 0; i < 3; i++) {
      timer.tick();
      await Promise.resolve();
    }
    expect(engine.data.length).toBe(299);
    for (let i = 0; i < 5; i++) {
      timer.tick();
      await Promise.resolve();
    }
    expect(engine.data.length).toBe(300);
    expect(ctrl.state).toBe('paused');
    expect(ctrl.status().atEnd).toBe(true);
  });

  it('keeps replay time across a timeframe change and exits cleanly', async () => {
    const { ctrl, engine, override } = setup();
    ctrl.startSelecting();
    await ctrl.selectBar(200);
    await ctrl.step();
    const cursor = ctrl.status().cursorTime!;
    await ctrl.changeTimeframe('4h');
    expect(ctrl.status().cursorTime).toBe(cursor);
    expect(ctrl.status().baseTimeframe).toBe('1h');
    const last = engine.data.bar(engine.data.lastIndex)!;
    expect(last.time).toBeLessThan(cursor);
    ctrl.exit();
    expect(ctrl.state).toBe('idle');
    expect(override).toHaveBeenLastCalledWith(false);
  });

  it('random start is deterministic for a seed', async () => {
    const a = setup();
    const b = setup();
    a.ctrl.startSelecting();
    b.ctrl.startSelecting();
    await a.ctrl.selectRandomBar();
    await b.ctrl.selectRandomBar();
    expect(a.engine.data.length).toBe(b.engine.data.length);
  });
});
