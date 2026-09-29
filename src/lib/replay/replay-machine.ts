export const REPLAY_STATES = ['idle', 'selecting', 'paused', 'playing', 'exited'] as const;
export type ReplayState = (typeof REPLAY_STATES)[number];

export type ReplayEvent =
  | 'START'
  | 'CANCEL'
  | 'SELECT'
  | 'PLAY'
  | 'PAUSE'
  | 'STEP'
  | 'TICK'
  | 'REACHED_END'
  | 'JUMP_END'
  | 'RESELECT'
  | 'EXIT'
  | 'RESET';

/** Explicit transition table: anything not listed is rejected. */
const TABLE: Readonly<Record<ReplayState, Partial<Record<ReplayEvent, ReplayState>>>> = {
  idle: { START: 'selecting' },
  selecting: { CANCEL: 'idle', SELECT: 'paused', EXIT: 'exited' },
  paused: {
    PLAY: 'playing',
    STEP: 'paused',
    JUMP_END: 'paused',
    RESELECT: 'selecting',
    EXIT: 'exited',
  },
  playing: {
    PAUSE: 'paused',
    TICK: 'playing',
    STEP: 'paused',
    REACHED_END: 'paused',
    JUMP_END: 'paused',
    RESELECT: 'selecting',
    EXIT: 'exited',
  },
  exited: { RESET: 'idle', START: 'selecting' },
};

/** Pure transition function. Returns null for an invalid event in `state`. */
export function transition(state: ReplayState, event: ReplayEvent): ReplayState | null {
  return TABLE[state][event] ?? null;
}

export const isReplayActive = (s: ReplayState): boolean => s === 'paused' || s === 'playing';

/** Stateful wrapper with change notification. */
export class ReplayMachine {
  private current: ReplayState = 'idle';
  private listeners = new Set<(next: ReplayState, prev: ReplayState, event: ReplayEvent) => void>();

  get state(): ReplayState {
    return this.current;
  }

  can(event: ReplayEvent): boolean {
    return transition(this.current, event) !== null;
  }

  send(event: ReplayEvent): boolean {
    const next = transition(this.current, event);
    if (next === null) return false;
    const prev = this.current;
    this.current = next;
    for (const l of this.listeners) l(next, prev, event);
    return true;
  }

  onChange(fn: (next: ReplayState, prev: ReplayState, event: ReplayEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
