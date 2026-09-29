import {
  EventBus,
  type Candle,
  type ChartEngine,
  type Rng,
  type SeriesData,
  type Timer,
  type TimeframeId,
} from '@/lib/core';
import { ReplayMachine, isReplayActive, type ReplayState } from './replay-machine';
import { ReplayPicker } from './replay-picker';
import { ReplaySession } from './replay-session';
import { resolveBaseTimeframe } from './timeframe-policy';

/** Bars per second. */
export const REPLAY_SPEEDS = [10, 7, 5, 3, 1, 0.5, 0.3, 0.1] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

const MS_PER_SECOND = 1000;
const BASE_PAGE = 1000;
/** Refill the base buffer when fewer bars than this remain. */
const PREFETCH_BELOW = 200;

/** What the replay needs from the rest of the app (market data). */
export interface ReplayHost {
  /** Full (unrevealed) history of the current chart timeframe. */
  fullData(): SeriesData;
  timeframe(): TimeframeId;
  /** Loads the chart at another timeframe without displaying it. */
  loadTimeframe(tf: TimeframeId): Promise<boolean>;
  fetchForward(tf: TimeframeId, startTime: number, limit: number): Promise<Candle[]>;
  /** While true the market layer must not push its data to the engine. */
  setDisplayOverride(active: boolean): void;
}

export interface ReplayStatus {
  readonly state: ReplayState;
  readonly speed: ReplaySpeed;
  readonly cursorTime: number | null;
  readonly atEnd: boolean;
  readonly baseTimeframe: TimeframeId | null;
  readonly loading: boolean;
}

export interface ReplayEventMap {
  'replay:changed': ReplayStatus;
}

/**
 * Orchestrates bar replay: the FSM, the data session, the tick timer and base-data fetching.
 * Deterministic: time only advances on ticks from the injected Timer.
 */
export class ReplayController {
  readonly events = new EventBus<ReplayEventMap>();
  readonly machine = new ReplayMachine();
  private session: ReplaySession | null = null;
  private speedValue: ReplaySpeed = 1;
  private interval: number | null = null;
  private loading = false;
  private readonly picker: ReplayPicker;
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly engine: ChartEngine,
    private readonly host: ReplayHost,
    private readonly timer: Timer,
    private readonly rng: Rng,
  ) {
    this.picker = new ReplayPicker(engine, (i) => void this.selectBar(i));
    this.disposers.push(
      engine.addInteractionHandler(this.picker),
      engine.addRenderer('overlay', this.picker.renderer),
      this.machine.onChange(() => this.emit()),
    );
  }

  get state(): ReplayState {
    return this.machine.state;
  }

  get active(): boolean {
    return isReplayActive(this.machine.state);
  }

  get speed(): ReplaySpeed {
    return this.speedValue;
  }

  status(): ReplayStatus {
    return {
      state: this.machine.state,
      speed: this.speedValue,
      cursorTime: this.session?.cursor ?? null,
      atEnd: this.session?.atEnd ?? false,
      baseTimeframe: this.session?.baseTimeframe ?? null,
      loading: this.loading,
    };
  }

  // ---- selection ---------------------------------------------------------------------------

  /** Enters "pick a start bar" mode (shows the full history so any bar can be picked). */
  startSelecting(): void {
    this.stopTimer();
    if (this.active) {
      this.machine.send('RESELECT');
      this.host.setDisplayOverride(false);
    } else if (!this.machine.send('START')) return;
    this.picker.setActive(true);
  }

  cancelSelecting(): void {
    if (this.machine.state !== 'selecting') return;
    this.picker.setActive(false);
    if (this.session) {
      // Re-selecting from an active replay: cancelling ends the replay.
      this.exit();
      return;
    }
    this.machine.send('CANCEL');
  }

  async selectBar(barIndex: number): Promise<void> {
    if (this.machine.state !== 'selecting') return;
    this.picker.setActive(false);
    const full = this.host.fullData();
    if (full.length === 0) return;
    this.session = ReplaySession.start(full, this.host.timeframe(), barIndex);
    this.host.setDisplayOverride(true);
    this.engine.setData(this.session.revealed);
    this.engine.scrollToLatest(false);
    this.machine.send('SELECT');
  }

  selectTime(time: number): Promise<void> {
    const full = this.host.fullData();
    let i = 0;
    while (i + 1 < full.length && full.time[i + 1]! <= time) i++;
    return this.selectBar(i);
  }

  selectFirstBar(): Promise<void> {
    return this.selectBar(0);
  }

  /** A random start bar (seeded RNG), leaving room to replay. */
  selectRandomBar(): Promise<void> {
    const n = this.host.fullData().length;
    return this.selectBar(this.rng.int(Math.min(n - 1, 50), Math.max(0, n - 20)));
  }

  // ---- playback ----------------------------------------------------------------------------

  play(): void {
    if (!this.session || this.session.atEnd || !this.machine.send('PLAY')) return;
    this.startTimer();
  }

  pause(): void {
    this.stopTimer();
    this.machine.send('PAUSE');
  }

  togglePlay(): void {
    if (this.machine.state === 'playing') this.pause();
    else this.play();
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speedValue = speed;
    if (this.machine.state === 'playing') this.startTimer();
    this.emit();
  }

  /** Manual single step (pauses playback). */
  async step(): Promise<void> {
    if (!this.active) return;
    this.stopTimer();
    this.machine.send('STEP');
    await this.advance();
  }

  jumpToEnd(): void {
    if (!this.session || !this.active) return;
    this.stopTimer();
    this.session.jumpToEnd();
    this.machine.send('JUMP_END');
    this.engine.scrollToLatest(true);
    this.emit();
  }

  exit(): void {
    this.stopTimer();
    this.picker.setActive(false);
    if (!this.machine.send('EXIT')) return;
    this.session = null;
    this.host.setDisplayOverride(false);
    this.engine.scrollToLatest(false);
    this.machine.send('RESET');
  }

  /** Called instead of a normal timeframe switch while replaying. Keeps replay time. */
  async changeTimeframe(tf: TimeframeId): Promise<boolean> {
    const session = this.session;
    if (!session || !this.active) return false;
    const wasPlaying = this.machine.state === 'playing';
    if (wasPlaying) this.pause();
    this.setLoading(true);
    try {
      if (!(await this.host.loadTimeframe(tf))) return true;
      const base = resolveBaseTimeframe(session.baseTimeframe, tf);
      let bars: Candle[] = [];
      let exhausted = true;
      if (base !== tf) {
        const from = ReplaySession.partialFrom(session.cursor, tf) ?? session.cursor;
        bars = await this.host.fetchForward(base, from, BASE_PAGE);
        exhausted = bars.length < BASE_PAGE;
      }
      session.rebase(this.host.fullData(), tf, base, bars, exhausted);
      this.engine.setData(session.revealed);
      this.engine.scrollToLatest(false);
    } finally {
      this.setLoading(false);
    }
    if (wasPlaying) this.play();
    return true;
  }

  /** Older history was prepended to the full series. */
  onHistoryPrepended(bars: readonly Candle[]): void {
    this.session?.prepend(bars);
  }

  // ---- internals ---------------------------------------------------------------------------

  private async advance(): Promise<void> {
    const s = this.session;
    if (!s || this.loading) return;
    let result = s.step();
    if (result === 'need-data') {
      await this.refill();
      result = s.step();
    }
    if (result === 'end' || s.atEnd) {
      this.stopTimer();
      this.machine.send('REACHED_END');
    } else if (s.canFetchMore && s.bufferedAhead < PREFETCH_BELOW) {
      void this.refill();
    }
    this.emit();
  }

  private async refill(): Promise<void> {
    const s = this.session;
    if (!s?.canFetchMore || this.loading) return;
    this.setLoading(true);
    try {
      const bars = await this.host.fetchForward(s.baseTimeframe, s.nextFetchTime, BASE_PAGE);
      if (this.session === s) s.addBaseBars(bars, bars.length < BASE_PAGE);
    } catch {
      if (this.session === s) s.addBaseBars([], true);
    } finally {
      this.setLoading(false);
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.interval = this.timer.setInterval(
      () => void this.advance(),
      MS_PER_SECOND / this.speedValue,
    );
  }

  private stopTimer(): void {
    if (this.interval !== null) this.timer.clearInterval(this.interval);
    this.interval = null;
  }

  private setLoading(loading: boolean): void {
    this.loading = loading;
    this.emit();
  }

  private emit(): void {
    this.events.emit('replay:changed', this.status());
  }

  destroy(): void {
    this.stopTimer();
    for (const d of this.disposers.splice(0)) d();
    this.events.clear();
  }
}
