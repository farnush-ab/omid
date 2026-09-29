'use client';

import { useEffect } from 'react';
import type { ChartApp } from '@/lib/app';
import { useUiStore } from '../state/ui-store';

const isEditable = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Forwards window key events to the app's keyboard controller (shortcut registry). */
export function useGlobalKeyboard(app: ChartApp | null): void {
  useEffect(() => {
    if (!app) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditable(e.target) || useUiStore.getState().dialog) return;
      const handled = app.keyboard.handle({
        key: e.key,
        code: e.code,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
        repeat: e.repeat,
      });
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);
}
