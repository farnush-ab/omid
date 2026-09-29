import { describe, expect, it } from 'vitest';
import { CommandHistory } from '@/lib/core';
import {
  AddDrawingsCommand,
  DrawingStore,
  RemoveDrawingsCommand,
  ReorderDrawingCommand,
  UpdateDrawingCommand,
  ToolDefaults,
  drawingRegistry,
} from '@/lib/drawings';
import { darkTheme } from '@/lib/themes';
import { at } from '../helpers/fake-context';

const def = drawingRegistry.require('trend-line');
const make = (id: string) =>
  def.create({ id, points: [at(0, 0), at(100, 100)], style: { ...def.defaults } });

describe('drawing commands', () => {
  it('add / remove / undo / redo', () => {
    const store = new DrawingStore();
    const h = new CommandHistory();
    h.execute(new AddDrawingsCommand(store, [make('a'), make('b')]));
    expect(store.all().map((d) => d.id)).toEqual(['a', 'b']);
    h.execute(new RemoveDrawingsCommand(store, ['a']));
    expect(store.all().map((d) => d.id)).toEqual(['b']);
    h.undo();
    expect(store.all().map((d) => d.id)).toEqual(['a', 'b']);
    h.undo();
    expect(store.size).toBe(0);
    h.redo();
    h.redo();
    expect(store.all().map((d) => d.id)).toEqual(['b']);
  });

  it('restores removed drawings at their original z-index', () => {
    const store = new DrawingStore();
    const h = new CommandHistory();
    h.execute(new AddDrawingsCommand(store, [make('a'), make('b'), make('c')]));
    h.execute(new RemoveDrawingsCommand(store, ['a', 'c']));
    h.undo();
    expect(store.all().map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('snapshot updates undo and merge', () => {
    const store = new DrawingStore();
    const h = new CommandHistory();
    const d = make('a');
    h.execute(new AddDrawingsCommand(store, [d]));
    const s0 = d.serialize();
    const s1 = { ...s0, style: { ...s0.style, color: '#ff0000' } };
    const s2 = { ...s0, style: { ...s0.style, color: '#00ff00' }, locked: true };
    h.execute(new UpdateDrawingCommand(store, 'a', s0, s1), { mergeable: true });
    h.execute(new UpdateDrawingCommand(store, 'a', s1, s2), { mergeable: true });
    expect(store.get('a')!.style.color).toBe('#00ff00');
    expect(store.get('a')!.locked).toBe(true);
    h.undo();
    expect(store.get('a')!.serialize()).toEqual(s0);
  });

  it('reorders and undoes', () => {
    const store = new DrawingStore();
    const h = new CommandHistory();
    h.execute(new AddDrawingsCommand(store, [make('a'), make('b'), make('c')]));
    h.execute(new ReorderDrawingCommand(store, 'a', 0, 2));
    expect(store.all().map((d) => d.id)).toEqual(['b', 'c', 'a']);
    h.undo();
    expect(store.all().map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('ToolDefaults', () => {
  it('layers definition defaults, theme bindings and user overrides', () => {
    const td = new ToolDefaults();
    expect(td.resolve(def, darkTheme).color).toBe(darkTheme.colors.drawingLine);
    td.set(def.id, { ...def.defaults, color: '#123456', lineWidth: 4 });
    const r = td.resolve(def, darkTheme);
    expect(r.color).toBe('#123456');
    expect(r.lineWidth).toBe(4);
    td.reset(def.id);
    expect(td.resolve(def, darkTheme).lineWidth).toBe(def.defaults.lineWidth);
  });
});
