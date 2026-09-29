import { beforeEach, describe, expect, it } from 'vitest';
import { createIdGenerator, createRng, type ChartPointerEvent } from '@/lib/core';
import { dataProviderRegistry, FALLBACK_PROVIDER_ID } from '@/lib/data';
import { drawingRegistry } from '@/lib/drawings';
import { MemoryStorage } from '@/lib/storage';
import { CapturingProvider, StorageLessonRepository, type LessonState } from '@/lib/lessons';
import {
  ChartApp,
  LessonPlayer,
  RecordingSession,
  VirtualMedia,
  captureChartState,
  recoverDraft,
} from '@/lib/app';
import { fakeContainer, fakeRuntime } from '../helpers/fake-dom';

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

/** Numbers rounded to 6 significant digits so float round-trips compare equal. */
function approx(state: LessonState, omit: string[] = []): unknown {
  const copy: Record<string, unknown> = { ...state };
  for (const k of omit) delete copy[k];
  return JSON.parse(
    JSON.stringify(copy, (_k, v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v !== 0 ? Number(v.toPrecision(6)) : v,
    ),
  );
}

function createClock() {
  let now = 1_700_000_000_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

async function createTeacher() {
  const clock = createClock();
  const { container } = fakeContainer(1000, 600);
  const { runtime, frames, timer } = fakeRuntime(clock);
  const synthetic = dataProviderRegistry
    .require(FALLBACK_PROVIDER_ID)
    .create({ clock, fetch: () => Promise.reject(new Error('offline')) });
  const provider = new CapturingProvider(synthetic);
  const app = new ChartApp(
    container,
    { runtime, clock, rng: createRng(1), storage: new MemoryStorage(), provider },
    { initialBars: 300 },
  );
  await app.start();
  frames.flush();
  return { app, clock, frames, timer, provider };
}

function createStudent(clock: { now(): number }, width = 1000, height = 600) {
  const { container } = fakeContainer(width, height);
  const { runtime, frames } = fakeRuntime(clock);
  const provider = dataProviderRegistry
    .require(FALLBACK_PROVIDER_ID)
    .create({ clock, fetch: () => Promise.reject(new Error('offline')) });
  const app = new ChartApp(
    container,
    { runtime, clock, rng: createRng(9), storage: new MemoryStorage(), provider },
    { persistDrawings: false },
  );
  return { app, frames };
}

interface Checkpoint {
  readonly t: number;
  readonly state: LessonState;
}

async function recordLesson() {
  const teacher = await createTeacher();
  const { app, clock, frames } = teacher;
  const repo = new StorageLessonRepository(new MemoryStorage());
  const session = new RecordingSession({
    app,
    repository: repo,
    provider: teacher.provider,
    clock,
    timer: teacher.timer,
    newId: createIdGenerator(createRng(3)),
    audio: null,
  });
  await session.start();
  const checkpoints: Checkpoint[] = [];
  const snap = () => {
    frames.flush();
    session.flush();
    checkpoints.push({ t: session.elapsed, state: captureChartState(app) });
  };
  snap();

  clock.advance(1000);
  app.engine.scrollBars(-40);
  snap();

  clock.advance(600);
  const d = app.drawings;
  const t0 = app.market.data.time[250]!;
  const t1 = app.market.data.time[280]!;
  const line = d.createDrawing('trend-line', [
    { time: t0, price: app.market.data.close[250]! },
    { time: t1, price: app.market.data.close[280]! },
  ])!;
  d.add([line]);
  snap();

  clock.advance(700);
  const pausedAt = session.elapsed;
  session.pause();
  clock.advance(60_000); // paused time must not exist in the lesson
  expect(session.elapsed).toBe(pausedAt);
  session.resume();
  clock.advance(400);
  app.engine.setOptions({ gridVertical: false, autoScale: false });
  app.engine.viewport.price.zoom(1.5);
  app.engine.viewportChanged();
  snap();

  clock.advance(500);
  app.engine.setCrosshair({ x: 400, y: 200, index: 0, time: 0, price: 0, region: 'price-pane' });
  snap();

  clock.advance(500);
  await app.setTimeframe('4h');
  await flushPromises();
  snap();

  clock.advance(800);
  app.themes.setActive('light');
  d.select(null);
  snap();

  clock.advance(1000);
  const meta = await session.stop('Test lesson');
  const lesson = (await repo.load(meta.id))!;
  return { lesson, checkpoints, clock, pausedAt, repo };
}

describe('record → replay', () => {
  let rec: Awaited<ReturnType<typeof recordLesson>>;
  beforeEach(async () => {
    rec = await recordLesson();
  });

  it('stores a lesson without the paused span', () => {
    const { lesson, checkpoints } = rec;
    expect(lesson.meta.title).toBe('Test lesson');
    expect(lesson.meta.audioType).toBeNull();
    // 1000 + 600 + 700 + 400 + 500 + 500 + 800 + 1000 ms of active time; the 60 s pause is gone.
    expect(lesson.timeline.duration).toBe(5500);
    expect(checkpoints.at(-1)!.t).toBe(4500);
    expect(lesson.timeline.datasets.map((d) => d.key).sort()).toEqual(['BTCUSDT|1h', 'BTCUSDT|4h']);
  });

  it('reproduces the teacher chart at every checkpoint, in any seek order', () => {
    const { app, frames } = createStudent(rec.clock);
    const player = new LessonPlayer(
      app,
      rec.lesson,
      new VirtualMedia(rec.lesson.timeline.duration, rec.clock.now),
      frames,
    );
    const order = [...rec.checkpoints.keys()].reverse().concat([2, 0, 5, 1, 4, 3]);
    for (const i of order) {
      const cp = rec.checkpoints[i]!;
      player.seek(cp.t);
      frames.flush();
      expect(approx(captureChartState(app)), `checkpoint ${i} @${cp.t}ms`).toEqual(
        approx(cp.state),
      );
    }
    player.destroy();
    app.destroy();
  });

  it('keeps the same visible window on a different screen size', () => {
    const { app, frames } = createStudent(rec.clock, 500, 300);
    const player = new LessonPlayer(
      app,
      rec.lesson,
      new VirtualMedia(rec.lesson.timeline.duration, rec.clock.now),
      frames,
    );
    const cp = rec.checkpoints[2]!;
    player.seek(cp.t);
    frames.flush();
    const s = captureChartState(app) as Record<string, { r: number; b: number }>;
    const teacher = cp.state as Record<string, { r: number; b: number }>;
    expect(s.view!.r).toBeCloseTo(teacher.view!.r, -1);
    expect(s.view!.b).toBeCloseTo(teacher.view!.b / 2, 6);
    expect(player.snapshot.stage).toEqual(teacher.stage);
  });

  it('plays in sync with the media clock, at any speed', async () => {
    const { clock, lesson } = rec;
    const { app, frames } = createStudent(clock);
    const media = new VirtualMedia(lesson.timeline.duration, clock.now);
    const player = new LessonPlayer(app, lesson, media, frames);
    await player.play();
    expect(player.snapshot.mode).toBe('lesson');
    clock.advance(1200);
    frames.flush();
    expect(player.time).toBe(1200);
    // With auto-scale on, the price range is derived by the chart, not replayed.
    const noRange = (st: LessonState) => {
      const view = { ...(st.view as Record<string, unknown>) };
      delete view.lo;
      delete view.hi;
      return approx({ ...st, view });
    };
    expect(noRange(captureChartState(app))).toEqual(noRange(player.index.stateAt(1200)));
    player.setRate(2);
    clock.advance(500);
    frames.flush();
    expect(player.time).toBe(2200);
    clock.advance(10_000);
    frames.flush();
    expect(player.time).toBe(lesson.timeline.duration);
    expect(player.snapshot.mode).toBe('free');
  });

  it('isolates student changes: resume and reset restore the lesson, the timeline never changes', async () => {
    const { clock, lesson } = rec;
    const frozen = JSON.stringify(lesson.timeline);
    const { app, frames } = createStudent(clock);
    const player = new LessonPlayer(
      app,
      lesson,
      new VirtualMedia(lesson.timeline.duration, clock.now),
      frames,
    );
    const cp = rec.checkpoints[3]!;
    player.seek(cp.t);
    expect(player.snapshot.mode).toBe('free');
    // Student plays around while paused.
    app.drawings.removeAll();
    app.engine.scrollBars(100);
    app.themes.setActive('dark');
    expect(player.snapshot.modified).toBe(true);
    expect(app.drawings.store.size).toBe(0);

    player.resetToLesson();
    frames.flush();
    expect(player.snapshot.modified).toBe(false);
    expect(approx(captureChartState(app))).toEqual(approx(cp.state));

    app.drawings.removeAll();
    await player.play();
    frames.flush();
    expect(app.drawings.store.size).toBe(1);
    expect(JSON.stringify(lesson.timeline)).toBe(frozen);
  });
});

describe('crash recovery', () => {
  it('recovers an unfinished recording from its autosaved draft', async () => {
    const teacher = await createTeacher();
    const repo = new StorageLessonRepository(new MemoryStorage());
    const session = new RecordingSession({
      app: teacher.app,
      repository: repo,
      provider: teacher.provider,
      clock: teacher.clock,
      timer: teacher.timer,
      newId: createIdGenerator(createRng(4)),
      audio: null,
    });
    await session.start();
    teacher.clock.advance(2000);
    teacher.app.engine.scrollBars(-10);
    session.flush();
    await session.autosave();
    // The tab dies here: no stop().
    const drafts = await repo.listDrafts();
    expect(drafts).toHaveLength(1);
    const meta = await recoverDraft(repo, drafts[0]!.id, '');
    expect(meta!.title).toBe('Recovered lesson');
    expect(meta!.duration).toBe(2000);
    const lesson = (await repo.load(meta!.id))!;
    expect(lesson.timeline.ops.some((o) => o.s === 'view')).toBe(true);
    expect(lesson.timeline.datasets).toHaveLength(1);
    expect(await repo.listDrafts()).toHaveLength(0);
  });

  it('discard removes the draft', async () => {
    const teacher = await createTeacher();
    const repo = new StorageLessonRepository(new MemoryStorage());
    const session = new RecordingSession({
      app: teacher.app,
      repository: repo,
      provider: teacher.provider,
      clock: teacher.clock,
      timer: teacher.timer,
      newId: createIdGenerator(createRng(5)),
      audio: null,
    });
    await session.start();
    expect(await repo.listDrafts()).toHaveLength(1);
    await session.discard();
    expect(await repo.listDrafts()).toHaveLength(0);
    expect(await repo.list()).toHaveLength(0);
  });
});

/** Drives the drawing tools through the same handler the pointer router uses. */
function pointer(app: ChartApp) {
  const handler = app.engine.interactionHandlers.find((h) => h.id === 'drawings')!;
  const ev = (x: number, y: number): ChartPointerEvent => {
    const c = app.engine.coords;
    return {
      x,
      y,
      clientX: x,
      clientY: y,
      region: 'price-pane',
      pointerType: 'mouse',
      button: 0,
      shift: false,
      ctrl: false,
      alt: false,
      index: c.xToIndex(x),
      time: c.xToTime(x),
      price: c.yToPrice(y),
    };
  };
  return {
    down: (x: number, y: number) => handler.onPointerDown?.(ev(x, y)),
    drag: (x: number, y: number) => handler.onPointerMove?.(ev(x, y)),
    up: (x: number, y: number) => handler.onPointerUp?.(ev(x, y)),
    hover: (x: number, y: number) => handler.onHover?.(ev(x, y)),
    dbl: (x: number, y: number) => handler.onDoubleClick?.(ev(x, y)),
    cancel: () => handler.onCancel?.(),
  };
}

describe('drawings are replayed as a process', () => {
  interface Mid {
    readonly t: number;
    readonly tool: string;
    readonly points: number;
  }

  async function recordAllTools() {
    const teacher = await createTeacher();
    const { app, clock, frames } = teacher;
    const repo = new StorageLessonRepository(new MemoryStorage());
    const session = new RecordingSession({
      app,
      repository: repo,
      provider: teacher.provider,
      clock,
      timer: teacher.timer,
      newId: createIdGenerator(createRng(6)),
      audio: null,
    });
    await session.start();
    const p = pointer(app);
    const mids: Mid[] = [];
    const finished: Array<{ t: number; tool: string; count: number }> = [];
    const tick = (ms: number) => {
      clock.advance(ms);
      frames.flush();
    };
    const noteMid = (tool: string) => {
      const preview = app.drawings.placementPreview;
      if (preview) mids.push({ t: session.elapsed, tool, points: preview.points.length });
    };

    let y = 150;
    for (const def of drawingRegistry.list()) {
      app.drawings.setTool(def.id);
      tick(200);
      const kind = def.placement.kind;
      p.down(200, y);
      if (kind === 'single') {
        p.up(200, y);
      } else if (kind === 'freehand') {
        for (let i = 1; i <= 12; i++) {
          tick(50);
          p.drag(200 + i * 15, y + (i % 3) * 6);
          if (i === 6) noteMid(def.id);
        }
        p.up(380, y);
      } else {
        p.up(200, y);
        // The shape follows the pointer between clicks.
        for (let click = 1; app.drawings.placementPreview && click <= 4; click++) {
          for (let i = 1; i <= 6; i++) {
            tick(50);
            p.hover(200 + click * 80 + i * 5, y + click * 20 + i * 3);
            if (i === 3) noteMid(def.id);
          }
          const x = 200 + click * 80 + 30;
          const cy = y + click * 20 + 18;
          p.down(x, cy);
          p.up(x, cy);
          if (kind === 'polyline' && click === 2) p.dbl(x, cy);
        }
      }
      tick(10);
      expect(app.drawings.placementPreview, def.id).toBeNull();
      finished.push({ t: session.elapsed, tool: def.id, count: app.drawings.store.size });
      app.drawings.setTool(null);
      y += 40;
    }

    // A cancelled placement leaves nothing behind.
    app.drawings.setTool('trend-line');
    tick(100);
    p.down(600, 200);
    p.up(600, 200);
    tick(60);
    p.hover(650, 260);
    tick(60);
    p.hover(700, 280);
    noteMid('cancelled');
    tick(60);
    app.drawings.escape();
    tick(300);
    const afterCancel = { t: session.elapsed, count: app.drawings.store.size };

    const meta = await session.stop('Drawing lesson');
    return { lesson: (await repo.load(meta.id))!, mids, finished, afterCancel, clock };
  }

  it('shows the half-drawn shape at any time during placement, for every tool', async () => {
    const rec = await recordAllTools();
    const tools = new Set(rec.mids.map((m) => m.tool));
    for (const def of drawingRegistry.list())
      if (def.placement.kind !== 'single') expect(tools.has(def.id), def.id).toBe(true);

    const { app, frames } = createStudent(rec.clock);
    const player = new LessonPlayer(
      app,
      rec.lesson,
      new VirtualMedia(rec.lesson.timeline.duration, rec.clock.now),
      frames,
    );
    // Seek into the middle of each gesture, in reverse order too.
    for (const m of [...rec.mids, ...[...rec.mids].reverse()]) {
      player.seek(m.t);
      const ghost = app.drawings.placementGhost;
      expect(ghost?.type, `${m.tool} @${m.t}`).toBe(m.tool === 'cancelled' ? 'trend-line' : m.tool);
      expect(ghost!.points.length).toBe(m.points);
    }
    for (const f of rec.finished) {
      player.seek(f.t);
      expect(app.drawings.placementGhost, f.tool).toBeNull();
      expect(app.drawings.store.size, f.tool).toBe(f.count);
      expect(app.drawings.store.all().at(-1)!.type).toBe(f.tool);
    }
    player.seek(rec.afterCancel.t);
    expect(app.drawings.placementGhost).toBeNull();
    expect(app.drawings.store.size).toBe(rec.afterCancel.count);
  });

  it('moves the preview smoothly between samples during playback', async () => {
    const rec = await recordAllTools();
    const { app, frames } = createStudent(rec.clock);
    const player = new LessonPlayer(
      app,
      rec.lesson,
      new VirtualMedia(rec.lesson.timeline.duration, rec.clock.now),
      frames,
    );
    const ops = rec.lesson.timeline.ops.filter((o) => o.s === 'placement' && o.v);
    const i = ops.findIndex(
      (o, k) =>
        k + 1 < ops.length &&
        ops[k + 1]!.t - o.t <= 60 &&
        (o.v as { id: string }).id === (ops[k + 1]!.v as { id: string }).id,
    );
    const a = ops[i]!;
    const b = ops[i + 1]!;
    type Snap = { points: Array<{ time: number; price: number }> };
    player.seek((a.t + b.t) / 2);
    const last = (s: Snap) => s.points.at(-1)!.price;
    const mid = last(app.drawings.placementGhost!.serialize() as unknown as Snap);
    const [pa, pb] = [last(a.v as Snap), last(b.v as Snap)];
    expect(mid).toBeGreaterThan(Math.min(pa, pb) - 1e-9);
    expect(mid).toBeLessThan(Math.max(pa, pb) + 1e-9);
  });
});
