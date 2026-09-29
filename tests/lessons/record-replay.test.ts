import { beforeEach, describe, expect, it } from 'vitest';
import { createIdGenerator, createRng } from '@/lib/core';
import { dataProviderRegistry, FALLBACK_PROVIDER_ID } from '@/lib/data';
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
