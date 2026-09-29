import { describe, expect, it } from 'vitest';
import { CommandHistory, EventBus, createIdGenerator, createRng } from '@/lib/core';
import { DrawingManager, drawingRegistry } from '@/lib/drawings';
import { MemoryStorage, VersionedStore } from '@/lib/storage';
import { DrawingPersistence } from '@/lib/app/services/drawing-persistence';
import { ThemeService } from '@/lib/app/services/theme-service';
import type { AppEventMap } from '@/lib/app';
import { darkTheme } from '@/lib/themes';
import { at } from '../helpers/fake-context';
import { ManualTimer, fakeEngine } from '../helpers/fake-engine';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(storage = new MemoryStorage(), seed = 1) {
  const engine = fakeEngine();
  const history = new CommandHistory();
  const manager = new DrawingManager(
    engine,
    history,
    drawingRegistry,
    createIdGenerator(createRng(seed)),
  );
  const timer = new ManualTimer();
  const events = new EventBus<AppEventMap>();
  const persistence = new DrawingPersistence(manager, new VersionedStore(storage), events, timer);
  return { manager, persistence, timer, storage, history, events };
}

describe('DrawingPersistence', () => {
  it('saves per symbol and restores on switch', async () => {
    const { manager, persistence, timer, storage } = setup();
    await persistence.switchSymbol('BTCUSDT');
    manager.add([manager.createDrawing('trend-line', [at(0, 0), at(100, 100)])!]);
    timer.runAll();
    await flush();
    const saved = (await storage.get('drawings:BTCUSDT')) as {
      schemaVersion: number;
      data: { drawings: unknown[] };
    };
    expect(saved.schemaVersion).toBe(2);
    expect(saved.data.drawings).toHaveLength(1);

    await persistence.switchSymbol('ETHUSDT');
    expect(manager.store.size).toBe(0);
    await persistence.switchSymbol('BTCUSDT');
    expect(manager.store.size).toBe(1);
    expect(manager.store.all()[0]!.type).toBe('trend-line');
  });

  it('loads legacy v1 files through the migration pipeline', async () => {
    const storage = new MemoryStorage();
    await storage.set('drawings:BTCUSDT', {
      kind: 'drawings',
      schemaVersion: 1,
      data: {
        symbol: 'BTCUSDT',
        drawings: [
          {
            id: 'old',
            tool: 'rectangle',
            pts: [
              [0, 1],
              [3_600_000, 2],
            ],
            style: {},
          },
        ],
      },
    });
    const { manager, persistence } = setup(storage);
    await persistence.switchSymbol('BTCUSDT');
    expect(manager.store.get('old')?.type).toBe('rectangle');
  });

  it('skips unknown or corrupt drawings without failing the whole file', async () => {
    const storage = new MemoryStorage();
    await storage.set('drawings:BTCUSDT', {
      kind: 'drawings',
      schemaVersion: 2,
      data: {
        symbol: 'BTCUSDT',
        drawings: [
          { id: 'a', type: 'nope', points: [], style: {}, locked: false, hidden: false },
          {
            id: 'b',
            type: 'text',
            points: [{ time: 0, price: 1 }],
            style: { text: 'hi' },
            locked: false,
            hidden: false,
          },
          'garbage',
        ],
      },
    });
    const { manager, persistence, events } = setup(storage);
    const toasts: string[] = [];
    events.on('toast', (t) => toasts.push(t.message));
    await persistence.switchSymbol('BTCUSDT');
    expect(manager.store.size).toBe(1);
    expect(toasts[0]).toMatch(/Skipped 2/);
  });

  it('exports and re-imports drawings as JSON (new ids, undoable)', async () => {
    const a = setup();
    await a.persistence.switchSymbol('BTCUSDT');
    a.manager.add([a.manager.createDrawing('rectangle', [at(0, 0), at(50, 50)])!]);
    const json = JSON.parse(a.persistence.exportJson());
    const b = setup(new MemoryStorage(), 2);
    await b.persistence.switchSymbol('BTCUSDT');
    const res = b.persistence.importJson(json);
    expect(res).toEqual({ ok: true, count: 1, skipped: 0 });
    expect(b.manager.store.all()[0]!.id).not.toBe(a.manager.store.all()[0]!.id);
    b.history.undo();
    expect(b.manager.store.size).toBe(0);
    expect(b.persistence.importJson({ nope: true }).ok).toBe(false);
  });

  it('persists per-tool default styles', async () => {
    const { manager, timer, storage } = setup();
    manager.defaults.set('trend-line', {
      ...drawingRegistry.require('trend-line').defaults,
      lineWidth: 4,
    });
    timer.runAll();
    await flush();
    const other = setup(storage);
    await other.persistence.loadDefaults();
    expect(
      other.manager.defaults.resolve(drawingRegistry.require('trend-line'), darkTheme).lineWidth,
    ).toBe(4);
  });
});

describe('ThemeService', () => {
  function themes(storage = new MemoryStorage()) {
    const engine = fakeEngine();
    const svc = new ThemeService(
      engine,
      new VersionedStore(storage),
      new EventBus<AppEventMap>(),
      createIdGenerator(createRng(3)),
    );
    return { svc, engine, storage };
  }

  it('creates, renames, activates, previews and deletes themes; persists them', async () => {
    const { svc, engine, storage } = themes();
    await svc.load();
    const t = svc.duplicate('dark', 'Mine');
    svc.setActive(t.id);
    svc.rename(t.id, 'Night');
    svc.save(t.id, { ...t.colors, background: '#000000' });
    expect(engine.currentTheme.colors.background).toBe('#000000');
    svc.preview({ ...svc.active, colors: { ...svc.active.colors, background: '#111111' } });
    expect(engine.currentTheme.colors.background).toBe('#111111');
    svc.preview(null);
    expect(engine.currentTheme.colors.background).toBe('#000000');
    await flush();

    const again = themes(storage);
    await again.svc.load();
    expect(again.svc.active.name).toBe('Night');
    again.svc.remove(again.svc.active.id);
    expect(again.svc.active.id).toBe('dark');
  });

  it('never mutates built-ins: editing a built-in colour forks a custom theme', async () => {
    const { svc } = themes();
    await svc.load();
    svc.setActiveColor('upBody', '#00ff00');
    expect(svc.active.builtIn).toBe(false);
    expect(svc.find('dark')!.colors.upBody).toBe(darkTheme.colors.upBody);
  });

  it('exports and imports theme files', async () => {
    const a = themes();
    await a.svc.load();
    const t = a.svc.duplicate('light', 'Paper');
    const json = JSON.parse(a.svc.exportTheme(t.id));
    const b = themes();
    await b.svc.load();
    const res = b.svc.importTheme(json);
    expect(res.ok && res.theme.name).toBe('Paper');
    expect(b.svc.importTheme({ junk: 1 }).ok).toBe(false);
  });
});
