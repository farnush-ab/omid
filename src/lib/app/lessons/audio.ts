/**
 * Ports between lessons and the browser's media APIs. The recording session and the player only
 * see these interfaces; tests use fakes, the browser uses MediaRecorder / HTMLAudioElement.
 */

export type MicErrorKind = 'denied' | 'no-device' | 'unsupported' | 'busy' | 'unknown';

export class MicError extends Error {
  constructor(
    readonly kind: MicErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** Voice capture. `start()` resolves once audio is actually being recorded. */
export interface AudioCapture {
  readonly mimeType: string;
  start(onChunk: (chunk: Blob) => void, onEnded: () => void): Promise<void>;
  pause(): void;
  resume(): void;
  /** Stops and releases the microphone; resolves after the last chunk was delivered. */
  stop(): Promise<void>;
}

/** Time source during playback: the voice track, or a virtual clock for silent lessons. */
export interface PlaybackMedia {
  /** Current media time (ms). */
  readonly time: number;
  readonly playing: boolean;
  play(): Promise<void>;
  pause(): void;
  seek(ms: number): void;
  setRate(rate: number): void;
  /** Fires when the media reaches its end or stalls/resumes; returns an unsubscribe. */
  onEnded(listener: () => void): () => void;
  destroy(): void;
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
];

/** Low bitrate mono speech keeps a 30-minute lesson at a few MB. */
export const VOICE_BITS_PER_SECOND = 24_000;

function micErrorFrom(e: unknown): MicError {
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new MicError('denied', 'Microphone access was denied.');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new MicError('no-device', 'No microphone was found.');
    case 'NotReadableError':
    case 'AbortError':
      return new MicError('busy', 'The microphone is in use by another application.');
    default:
      return new MicError('unknown', e instanceof Error ? e.message : 'Microphone error.');
  }
}

/** Asks for the microphone. Throws MicError with a user-presentable kind. */
export async function requestMicrophone(): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    throw new MicError('unsupported', 'This browser cannot record audio.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (e) {
    throw micErrorFrom(e);
  }
}

/** MediaRecorder-backed capture of an already granted microphone stream. */
export class BrowserAudioCapture implements AudioCapture {
  readonly mimeType: string;
  private recorder: MediaRecorder | null = null;
  private stopped: Promise<void> | null = null;

  constructor(private readonly stream: MediaStream) {
    this.mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  }

  start(onChunk: (chunk: Blob) => void, onEnded: () => void): Promise<void> {
    const rec = new MediaRecorder(this.stream, {
      ...(this.mimeType ? { mimeType: this.mimeType } : {}),
      audioBitsPerSecond: VOICE_BITS_PER_SECOND,
    });
    this.recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) onChunk(e.data);
    };
    for (const track of this.stream.getAudioTracks()) track.onended = onEnded;
    this.stopped = new Promise((resolve) => {
      rec.onstop = () => resolve();
    });
    return new Promise((resolve, reject) => {
      rec.onstart = () => resolve();
      rec.onerror = () => reject(new MicError('unknown', 'Audio recording failed.'));
      // 1 s chunks: they are autosaved, so a crash loses at most about a second of voice.
      rec.start(1000);
    });
  }

  pause(): void {
    if (this.recorder?.state === 'recording') this.recorder.pause();
  }

  resume(): void {
    if (this.recorder?.state === 'paused') this.recorder.resume();
  }

  async stop(): Promise<void> {
    const rec = this.recorder;
    if (rec && rec.state !== 'inactive') {
      rec.requestData();
      rec.stop();
      await this.stopped;
    }
    for (const t of this.stream.getTracks()) t.stop();
  }
}

/** The voice track drives lesson time: the chart can never drift from the audio. */
export class HtmlAudioMedia implements PlaybackMedia {
  private readonly listeners = new Set<() => void>();
  private lastRaw = -1;
  private lastRawAt = 0;

  constructor(
    private readonly el: HTMLAudioElement,
    private readonly perfNow: () => number,
  ) {
    el.preload = 'auto';
    el.onended = () => this.listeners.forEach((l) => l());
  }

  /**
   * Some browsers update currentTime only every few frames; between updates the time is
   * extrapolated (bounded) so motion stays smooth while remaining locked to the audio.
   */
  get time(): number {
    const raw = this.el.currentTime * 1000;
    const now = this.perfNow();
    if (raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.lastRawAt = now;
      return raw;
    }
    if (!this.playing) return raw;
    const ahead = Math.min((now - this.lastRawAt) * this.el.playbackRate, 250);
    return raw + ahead;
  }

  get playing(): boolean {
    return !this.el.paused && !this.el.ended && this.el.readyState >= 3;
  }

  async play(): Promise<void> {
    await this.el.play();
  }

  pause(): void {
    this.el.pause();
  }

  seek(ms: number): void {
    this.el.currentTime = Math.max(0, ms / 1000);
    this.lastRaw = -1;
  }

  setRate(rate: number): void {
    this.el.playbackRate = rate;
  }

  onEnded(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.el.pause();
    this.el.onended = null;
    this.el.removeAttribute('src');
    this.el.load();
    this.listeners.clear();
  }
}

/** Clock-driven playback for lessons recorded without voice. */
export class VirtualMedia implements PlaybackMedia {
  private base = 0;
  private startedAt = 0;
  private rate = 1;
  private running = false;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly duration: number,
    private readonly perfNow: () => number,
  ) {}

  get time(): number {
    if (!this.running) return this.base;
    const t = this.base + (this.perfNow() - this.startedAt) * this.rate;
    if (t >= this.duration) {
      this.base = this.duration;
      this.running = false;
      this.listeners.forEach((l) => l());
      return this.duration;
    }
    return t;
  }

  get playing(): boolean {
    return this.running;
  }

  async play(): Promise<void> {
    if (this.base >= this.duration) this.base = 0;
    this.startedAt = this.perfNow();
    this.running = true;
  }

  pause(): void {
    this.base = this.time;
    this.running = false;
  }

  seek(ms: number): void {
    this.base = Math.max(0, Math.min(this.duration, ms));
    this.startedAt = this.perfNow();
  }

  setRate(rate: number): void {
    this.base = this.time;
    this.startedAt = this.perfNow();
    this.rate = rate;
  }

  onEnded(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.running = false;
    this.listeners.clear();
  }
}
