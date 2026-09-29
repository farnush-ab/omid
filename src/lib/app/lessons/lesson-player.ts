import { EventBus, type FrameScheduler } from '@/lib/core';
import { LessonDataProvider, TimelineIndex, type Lesson, type LessonState } from '@/lib/lessons';
import type { ChartApp } from '../chart-app';
import type { PlaybackMedia } from './audio';
import {
  CHART_SLICE_BEHAVIORS,
  applyChartState,
  type CursorValue,
  type StageValue,
} from './chart-slices';

/** 'lesson': the chart follows the recording (read-only). 'free': paused, the student explores. */
export type PlayerMode = 'lesson' | 'free';

export const PLAYBACK_RATES = [1, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export interface PlayerSnapshot {
  readonly mode: PlayerMode;
  readonly playing: boolean;
  readonly rate: PlaybackRate;
  readonly duration: number;
  /** True once the student changed the chart since the last sync with the lesson. */
  readonly modified: boolean;
  readonly stage: StageValue | null;
}

export interface PlayerFrame {
  readonly time: number;
  /** Teacher pointer in chart pixels, null when hidden. */
  readonly cursor: { readonly x: number; readonly y: number } | null;
}

export interface PlayerEventMap {
  'state:changed': PlayerSnapshot;
  frame: PlayerFrame;
  error: { readonly message: string };
}

/**
 * Plays a lesson on a dedicated, storage-less ChartApp. Lesson time comes from the media (the
 * voice), so audio and chart cannot drift; every frame the chart is set to the timeline's state
 * at that time. The timeline is read-only: whatever the student does while paused is discarded
 * by the next resume, seek or reset.
 */
export class LessonPlayer {
  readonly events = new EventBus<PlayerEventMap>();
  readonly index: TimelineIndex;
  private readonly data: LessonDataProvider;
  private readonly offs: Array<() => void> = [];
  private mode: PlayerMode = 'free';
  private rate: PlaybackRate = 1;
  private modified = false;
  private applying = false;
  private prev: LessonState | null = null;
  private frameHandle = 0;
  private looping = false;
  private current = 0;
  private stage: StageValue | null = null;

  constructor(
    readonly app: ChartApp,
    readonly lesson: Lesson,
    private readonly media: PlaybackMedia,
    private readonly frames: FrameScheduler,
  ) {
    this.index = new TimelineIndex(lesson.timeline, CHART_SLICE_BEHAVIORS);
    this.data = new LessonDataProvider(lesson.timeline.datasets);
    const markModified = () => {
      if (this.applying || this.mode !== 'free' || this.modified) return;
      this.modified = true;
      this.emitState();
    };
    const e = app.engine.events;
    const d = app.drawings.events;
    this.offs.push(
      media.onEnded(() => this.onEnded()),
      e.on('viewport:changed', markModified),
      e.on('options:changed', markModified),
      d.on('drawings:changed', markModified),
      d.on('drawing:updated', markModified),
      d.on('selection:changed', markModified),
      d.on('tool:changed', markModified),
      d.on('modes:changed', markModified),
      app.events.on('themes:changed', markModified),
      e.on('resize', () => {
        if (this.mode === 'lesson' || !this.modified) this.sync(this.current, 'view');
      }),
    );
    this.sync(0, 'all');
  }

  get snapshot(): PlayerSnapshot {
    return {
      mode: this.mode,
      playing: this.mode === 'lesson',
      rate: this.rate,
      duration: this.index.duration,
      modified: this.modified,
      stage: this.stage,
    };
  }

  get time(): number {
    return this.current;
  }

  private emitState(): void {
    this.events.emit('state:changed', this.snapshot);
  }

  /** Applies the lesson state at `time`: 'all' re-applies everything, 'diff' only changes. */
  private sync(time: number, what: 'all' | 'diff' | 'view'): void {
    this.current = Math.max(0, Math.min(this.index.duration, time));
    const state = this.index.stateAt(this.current);
    let prev: LessonState | null = what === 'all' ? null : this.prev;
    if (what === 'view' && prev) prev = { ...prev, view: undefined, cursor: undefined };
    this.applying = true;
    try {
      applyChartState(this.app, state, prev, { data: this.data });
    } finally {
      this.applying = false;
    }
    if (what === 'all') {
      this.app.history.clear();
      this.modified = false;
    }
    this.prev = state;
    const stage = (state.stage as StageValue | undefined) ?? null;
    if (stage !== this.stage) {
      this.stage = stage;
      this.emitState();
    }
    this.events.emit('frame', { time: this.current, cursor: this.cursorPixels(state) });
  }

  private cursorPixels(state: LessonState): PlayerFrame['cursor'] {
    const c = state.cursor as CursorValue | null | undefined;
    if (!c) return null;
    const { width, height } = this.app.engine.getLayout();
    return { x: c.x * width, y: c.y * height };
  }

  async play(): Promise<void> {
    if (this.mode === 'lesson') return;
    if (this.current >= this.index.duration) this.seekMedia(0);
    // Resuming always returns to the recorded state; student changes are discarded.
    this.sync(this.current, 'all');
    this.mode = 'lesson';
    this.emitState();
    try {
      await this.media.play();
    } catch (e) {
      this.mode = 'free';
      this.emitState();
      this.events.emit('error', {
        message: e instanceof Error ? e.message : 'Playback failed',
      });
      return;
    }
    this.startLoop();
  }

  pause(): void {
    if (this.mode === 'free') return;
    this.media.pause();
    this.stopLoop();
    this.sync(this.media.time, 'diff');
    this.mode = 'free';
    this.modified = false;
    this.emitState();
  }

  toggle(): void {
    if (this.mode === 'lesson') this.pause();
    else void this.play();
  }

  /** Jumps to `ms` instantly, in sync, and shows the lesson state there. */
  seek(ms: number): void {
    const t = Math.max(0, Math.min(this.index.duration, ms));
    this.seekMedia(t);
    this.sync(t, 'all');
    this.emitState();
  }

  private seekMedia(t: number): void {
    this.media.seek(t);
    this.current = t;
  }

  /** Discards the student's changes and shows the lesson state at the current time. */
  resetToLesson(): void {
    this.sync(this.current, 'all');
    this.emitState();
  }

  setRate(rate: PlaybackRate): void {
    this.rate = rate;
    this.media.setRate(rate);
    this.emitState();
  }

  private startLoop(): void {
    if (this.looping) return;
    this.looping = true;
    const step = () => {
      if (!this.looping) return;
      const t = this.media.time;
      if (t >= this.index.duration) {
        this.onEnded();
        return;
      }
      this.sync(t, 'diff');
      this.frameHandle = this.frames.request(step);
    };
    this.frameHandle = this.frames.request(step);
  }

  private stopLoop(): void {
    this.looping = false;
    this.frames.cancel(this.frameHandle);
  }

  private onEnded(): void {
    if (this.mode !== 'lesson') return;
    this.stopLoop();
    this.media.pause();
    this.sync(this.index.duration, 'diff');
    this.mode = 'free';
    this.modified = false;
    this.emitState();
  }

  destroy(): void {
    this.stopLoop();
    for (const off of this.offs.splice(0)) off();
    this.media.destroy();
    this.events.clear();
  }
}
