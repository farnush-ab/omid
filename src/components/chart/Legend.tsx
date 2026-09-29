'use client';

import { useEffect, useRef } from 'react';
import { formatCompact, formatPercent, formatPrice, formatSigned } from '@/lib/core';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';

type Field = 'o' | 'h' | 'l' | 'c' | 'chg' | 'vol';

/**
 * Status line: symbol, interval and OHLCV of the hovered (or last) bar. Values are written
 * straight into DOM nodes on crosshair events, so hovering never re-renders React.
 */
export function Legend() {
  const app = useApp();
  const symbol = useUiStore((s) => s.symbol);
  const timeframe = useUiStore((s) => s.timeframe);
  const opts = useUiStore((s) => s.options);
  const refs = useRef<Partial<Record<Field, HTMLSpanElement | null>>>({});
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let hovered: number | null = null;
    const paint = () => {
      const data = app.engine.seriesData;
      const i = hovered ?? data.lastIndex;
      const bar = data.bar(i);
      if (!bar) return;
      const prevClose = data.bar(i - 1)?.close ?? bar.open;
      const change = bar.close - prevClose;
      const precision =
        app.engine.getOptions().pricePrecision >= 0
          ? app.engine.getOptions().pricePrecision
          : app.engine.getSymbol().pricePrecision;
      const r = refs.current;
      const set = (k: Field, text: string) => {
        const el = r[k];
        if (el && el.textContent !== text) el.textContent = text;
      };
      set('o', formatPrice(bar.open, precision));
      set('h', formatPrice(bar.high, precision));
      set('l', formatPrice(bar.low, precision));
      set('c', formatPrice(bar.close, precision));
      set(
        'chg',
        `${formatSigned(change, precision)} (${formatPercent((change / prevClose) * 100)})`,
      );
      set('vol', formatCompact(bar.volume));
      rowRef.current?.style.setProperty(
        '--legend-color',
        bar.close >= bar.open ? 'var(--tc-up)' : 'var(--tc-down)',
      );
    };
    const offs = [
      app.engine.events.on('crosshair:moved', (c) => {
        const next = c && c.barIndex >= 0 ? c.barIndex : null;
        if (next === hovered) return;
        hovered = next;
        paint();
      }),
      app.engine.events.on('data:changed', paint),
      app.engine.events.on('options:changed', paint),
    ];
    paint();
    return () => offs.forEach((off) => off());
  }, [app]);

  const cell = (label: string, k: Field) => (
    <span className="whitespace-nowrap">
      <span className="text-muted">{label}</span>
      <span
        ref={(el) => void (refs.current[k] = el)}
        className="ml-0.5 tabular-nums text-[var(--legend-color)]"
      />
    </span>
  );

  return (
    <div
      ref={rowRef}
      className="pointer-events-none absolute left-2 top-1.5 z-10 flex max-w-[calc(100%-90px)] flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] leading-5 text-fg"
    >
      {opts.showStatusSymbol ? (
        <span className="font-semibold">
          {symbol?.symbol ?? ''} · {timeframe}
          <span className="ml-1 font-normal text-muted">{symbol?.description}</span>
        </span>
      ) : null}
      {opts.showStatusOHLC ? (
        <>
          {cell('O', 'o')}
          {cell('H', 'h')}
          {cell('L', 'l')}
          {cell('C', 'c')}
        </>
      ) : null}
      {opts.showStatusChange ? (
        <span
          ref={(el) => void (refs.current.chg = el)}
          className="tabular-nums text-[var(--legend-color)]"
        />
      ) : null}
      {opts.showStatusVolume ? cell('Vol', 'vol') : null}
    </div>
  );
}
