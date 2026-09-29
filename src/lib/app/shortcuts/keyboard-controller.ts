import type { Timer, TimeframeId } from '@/lib/core';
import { APP_CONFIG } from '../config';
import { IntervalTyper } from './interval-typer';
import type { KeyInput } from './keys';
import type { ShortcutRegistry } from './shortcut-registry';

export interface KeyboardHost<C> {
  readonly context: C;
  setTimeframe(tf: TimeframeId): void;
  intervalTyperChanged(text: string | null, valid: boolean): void;
  startSymbolSearch(initial: string): void;
}

/** Routes key events: interval typer first, then the shortcut registry, then symbol search. */
export class KeyboardController<C> {
  private readonly typer = new IntervalTyper();
  private timeout: number | null = null;

  constructor(
    private readonly registry: ShortcutRegistry<C>,
    private readonly host: KeyboardHost<C>,
    private readonly timer: Timer,
  ) {}

  /** Returns true when the event was handled (caller should preventDefault). */
  handle(e: KeyInput): boolean {
    const plain = !e.ctrl && !e.meta && !e.alt;
    if (this.typer.active) {
      if (e.key === 'Enter') {
        const tf = this.typer.commit();
        if (tf) this.host.setTimeframe(tf);
        this.notify();
        return true;
      }
      if (e.key === 'Escape') {
        this.typer.cancel();
        this.notify();
        return true;
      }
      if (plain && this.typer.input(e.key)) {
        this.notify();
        return true;
      }
    } else if (plain && !e.shift && this.typer.input(e.key)) {
      this.notify();
      return true;
    }

    const shortcut = this.registry.match(e, this.host.context);
    if (shortcut) {
      shortcut.run(this.host.context);
      return true;
    }
    if (plain && /^[a-zA-Z]$/.test(e.key)) {
      this.host.startSymbolSearch(e.key.toUpperCase());
      return true;
    }
    return false;
  }

  private notify(): void {
    if (this.timeout !== null) this.timer.clearTimeout(this.timeout);
    this.timeout = null;
    this.host.intervalTyperChanged(this.typer.text, this.typer.parsed !== null);
    if (this.typer.active) {
      this.timeout = this.timer.setTimeout(() => {
        this.typer.cancel();
        this.notify();
      }, APP_CONFIG.intervalTyperTimeoutMs);
    }
  }

  destroy(): void {
    if (this.timeout !== null) this.timer.clearTimeout(this.timeout);
  }
}
