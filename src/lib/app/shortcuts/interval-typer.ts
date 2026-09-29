import { parseTimeframeInput, type TimeframeId } from '@/lib/core';

const ALLOWED = /^[0-9mhHdDwWM]$/;

/**
 * TradingView-style interval quick switch: typing a digit starts a buffer ("4", "4h", "15"),
 * Enter applies, Escape cancels. Pure state; the app wires it to key events and timers.
 */
export class IntervalTyper {
  private buffer: string | null = null;

  get text(): string | null {
    return this.buffer;
  }

  get active(): boolean {
    return this.buffer !== null;
  }

  get parsed(): TimeframeId | null {
    return this.buffer === null ? null : parseTimeframeInput(this.buffer);
  }

  /** Returns true when the key was consumed. */
  input(key: string): boolean {
    if (this.buffer === null) {
      if (!/^\d$/.test(key)) return false;
      this.buffer = key;
      return true;
    }
    if (key === 'Backspace') {
      this.buffer = this.buffer.slice(0, -1) || null;
      return true;
    }
    if (ALLOWED.test(key) && this.buffer.length < 4) {
      this.buffer += key;
      return true;
    }
    return false;
  }

  /** Returns the chosen timeframe (or null if invalid) and resets. */
  commit(): TimeframeId | null {
    const tf = this.parsed;
    this.buffer = null;
    return tf;
  }

  cancel(): void {
    this.buffer = null;
  }
}
