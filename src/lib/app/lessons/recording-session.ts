import { EventBus, type Clock, type IdGenerator, type Timer } from '@/lib/core';
import {
  DatasetCollector,
  RecordingClock,
  TimelineRecorder,
  fixWebmDuration,
  type CapturingProvider,
  type LessonMeta,
  type LessonRepository,
} from '@/lib/lessons';
import type { ChartApp } from '../chart-app';
import type { AudioCapture } from './audio';
import { CHART_SLICES, captureChartState } from './chart-slices';

export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'saving' | 'done';

export interface RecordingEventMap {
  'status:changed': { readonly status: RecordingStatus };
  /** The microphone went away mid-recording; the session paused itself. */
  'mic:lost': Record<string, never>;
  /** Autosave failed; the recording continues in memory. */
  'autosave:failed': { readonly message: string };
}

export interface RecordingSessionDeps {
  readonly app: ChartApp;
  readonly repository: LessonRepository;
  readonly provider: CapturingProvider;
  readonly clock: Clock;
  readonly timer: Timer;
  readonly newId: IdGenerator;
  /** Null records without voice. */
  readonly audio: AudioCapture | null;
}

export const AUTOSAVE_INTERVAL_MS = 3000;
const TICK_MS = 100;

/**
 * One recording: watches the chart slices, keeps the op log on a pause-aware clock, captures the
 * market data it shows and the voice, and autosaves a recoverable draft every few seconds.
 */
export class RecordingSession {
  readonly events = new EventBus<RecordingEventMap>();
  readonly id: string;
  private readonly clock: RecordingClock;
  private readonly recorder: TimelineRecorder;
  private readonly datasets = new DatasetCollector();
  private readonly offs: Array<() => void> = [];
  private readonly pendingAudio: Blob[] = [];
  private audioChunks: Blob[] = [];
  private audioSeq = 0;
  private opSeq = 0;
  private savedOps = 0;
  private savedDatasetRev = -1;
  private status: RecordingStatus = 'idle';
  private createdAt = 0;
  private tickHandle = 0;
  private autosaveHandle = 0;
  private saving: Promise<void> = Promise.resolve();
  private micLost = false;

  constructor(private readonly deps: RecordingSessionDeps) {
    this.id = deps.newId();
    this.clock = new RecordingClock(deps.clock);
    this.recorder = new TimelineRecorder(this.clock);
  }

  get state(): RecordingStatus {
    return this.status;
  }

  /** Lesson time recorded so far (ms). */
  get elapsed(): number {
    return this.clock.state === 'idle' ? 0 : this.clock.now();
  }

  get hasAudio(): boolean {
    return this.deps.audio !== null && !this.micLost;
  }

  get microphoneLost(): boolean {
    return this.micLost;
  }

  private setStatus(status: RecordingStatus): void {
    this.status = status;
    this.events.emit('status:changed', { status });
  }

  async start(): Promise<void> {
    if (this.status !== 'idle') return;
    this.setStatus('starting');
    const { app, audio } = this.deps;
    try {
      if (audio)
        await audio.start(
          (chunk) => this.onAudioChunk(chunk),
          () => this.onMicEnded(),
        );
    } catch (e) {
      this.setStatus('idle');
      throw e;
    }
    this.createdAt = this.deps.clock.now();
    // The bars on screen were loaded before recording began: seed the lesson with them.
    const e = app.engine;
    this.datasets.add(e.getSymbol(), e.getTimeframe().id, app.market.data.toCandles());
    this.deps.provider.setSink((symbol, tf, bars) => this.datasets.add(symbol, tf, bars));
    this.clock.start();
    this.recorder.begin(captureChartState(app));
    for (const slice of CHART_SLICES) {
      const changed = () => {
        if (this.status !== 'recording' && this.status !== 'paused') return;
        if (slice.id === 'market') this.captureDisplayed();
        const value = slice.capture(app);
        if (slice.mode === 'sample') this.recorder.sample(slice.id, value);
        else this.recorder.record(slice.id, value);
      };
      this.offs.push(slice.watch(app, changed));
    }
    const { timer } = this.deps;
    this.tickHandle = timer.setInterval(() => this.tick(), TICK_MS);
    this.autosaveHandle = timer.setInterval(() => void this.autosave(), AUTOSAVE_INTERVAL_MS);
    this.setStatus('recording');
    await this.autosave();
  }

  /** Stores what the chart displays now (covers data that did not come through the provider). */
  private captureDisplayed(): void {
    const e = this.deps.app.engine;
    this.datasets.add(e.getSymbol(), e.getTimeframe().id, e.seriesData.toCandles());
  }

  /** Writes pending throttled samples now (runs on the periodic tick). */
  flush(): void {
    this.tick();
  }

  private tick(): void {
    if (this.status !== 'recording') return;
    for (const slice of CHART_SLICES) {
      if (!slice.poll) continue;
      const value = slice.capture(this.deps.app);
      if (slice.mode === 'sample') this.recorder.sample(slice.id, value);
      else this.recorder.record(slice.id, value);
    }
    this.recorder.flush();
  }

  pause(): void {
    if (this.status !== 'recording') return;
    this.recorder.flush();
    this.deps.audio?.pause();
    this.clock.pause();
    this.setStatus('paused');
    void this.autosave();
  }

  resume(): void {
    if (this.status !== 'paused' || (this.micLost && this.deps.audio)) return;
    this.deps.audio?.resume();
    this.clock.resume();
    this.setStatus('recording');
  }

  private onAudioChunk(chunk: Blob): void {
    this.audioChunks.push(chunk);
    this.pendingAudio.push(chunk);
  }

  private onMicEnded(): void {
    if (this.status !== 'recording' && this.status !== 'paused') return;
    this.micLost = true;
    this.pause();
    this.events.emit('mic:lost', {});
  }

  /** Writes everything new since the last autosave. Serialized; never throws. */
  autosave(): Promise<void> {
    this.saving = this.saving
      .then(() => this.writeDraft())
      .catch((e: unknown) => {
        this.events.emit('autosave:failed', {
          message: e instanceof Error ? e.message : String(e),
        });
      });
    return this.saving;
  }

  private async writeDraft(): Promise<void> {
    if (this.status === 'idle' || this.status === 'done') return;
    const repo = this.deps.repository;
    await repo.writeDraftHeader({
      id: this.id,
      createdAt: this.createdAt,
      audioType: this.deps.audio?.mimeType ?? null,
      initial: this.recorder.initial,
      reached: this.clock.now(),
    });
    const ops = this.recorder.opsFrom(this.savedOps);
    if (ops.length > 0) {
      await repo.appendDraftOps(this.id, this.opSeq++, ops);
      this.savedOps += ops.length;
    }
    while (this.pendingAudio.length > 0) {
      await repo.appendDraftAudio(this.id, this.audioSeq++, this.pendingAudio[0]!);
      this.pendingAudio.shift();
    }
    if (this.datasets.revision !== this.savedDatasetRev) {
      const rev = this.datasets.revision;
      await repo.writeDraftDatasets(this.id, this.datasets.toDatasets());
      this.savedDatasetRev = rev;
    }
  }

  private detach(): void {
    const { timer, provider } = this.deps;
    timer.clearInterval(this.tickHandle);
    timer.clearInterval(this.autosaveHandle);
    provider.setSink(null);
    for (const off of this.offs.splice(0)) off();
  }

  /**
   * Finishes the lesson and stores it. On failure the draft is kept (recoverable from the
   * library) and the error is rethrown.
   */
  async stop(title: string): Promise<LessonMeta> {
    if (this.status !== 'recording' && this.status !== 'paused') throw new Error('Not recording');
    this.recorder.flush();
    const duration = this.clock.stop();
    this.detach();
    this.setStatus('saving');
    await this.deps.audio?.stop().catch(() => undefined);
    await this.autosave();
    const audioType = this.deps.audio?.mimeType ?? null;
    const audio = await buildAudio(this.audioChunks, audioType, duration);
    const timeline = this.recorder.finish(duration, this.datasets.toDatasets());
    try {
      const meta = await this.deps.repository.save(
        {
          id: this.id,
          title: title.trim() || 'Untitled lesson',
          createdAt: this.createdAt,
          duration: timeline.duration,
          audioType: audio ? audioType : null,
        },
        timeline,
        audio,
      );
      await this.deps.repository.removeDraft(this.id).catch(() => undefined);
      this.setStatus('done');
      return meta;
    } catch (e) {
      this.setStatus('paused');
      throw e;
    }
  }

  /** Throws the recording away, including its draft. */
  async discard(): Promise<void> {
    if (this.status === 'done') return;
    this.detach();
    this.clock.stop();
    this.setStatus('done');
    await this.deps.audio?.stop().catch(() => undefined);
    await this.saving;
    await this.deps.repository.removeDraft(this.id);
  }

  destroy(): void {
    this.detach();
    this.events.clear();
  }
}

/** Joins voice chunks and makes WebM seekable by writing its duration. */
export async function buildAudio(
  chunks: readonly Blob[],
  type: string | null,
  durationMs: number,
): Promise<Blob | null> {
  if (!type || chunks.length === 0) return null;
  const blob = new Blob(chunks as BlobPart[], { type });
  if (!type.includes('webm')) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([fixWebmDuration(bytes, durationMs) as BlobPart], { type });
}
