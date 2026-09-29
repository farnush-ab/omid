import type { StorageAdapter } from '@/lib/core';
import { decodeTimeline, encodeTimeline } from './codec';
import type { LessonDataset, LessonState, LessonTimeline, TimelineOp } from './types';

export interface LessonMeta {
  readonly id: string;
  readonly title: string;
  /** Epoch ms. */
  readonly createdAt: number;
  /** Lesson length (ms). */
  readonly duration: number;
  /** MIME type of the voice track, or null for a silent lesson. */
  readonly audioType: string | null;
  /** Stored size (timeline + audio) in bytes. */
  readonly bytes: number;
}

export interface Lesson {
  readonly meta: LessonMeta;
  readonly timeline: LessonTimeline;
  readonly audio: Blob | null;
}

/** Everything known about an unfinished recording at its last autosave. */
export interface DraftHeader {
  readonly id: string;
  readonly createdAt: number;
  readonly audioType: string | null;
  readonly initial: LessonState;
  /** Lesson time reached at the last autosave (ms). */
  readonly reached: number;
}

export interface Draft {
  readonly header: DraftHeader;
  readonly ops: TimelineOp[];
  readonly datasets: LessonDataset[];
  readonly audio: Blob[];
}

/**
 * Persistence port for lessons. The browser implementation stores into IndexedDB through a
 * StorageAdapter; a backend implementation only needs to satisfy this interface (drafts can stay
 * local while finished lessons are uploaded).
 */
export interface LessonRepository {
  list(): Promise<LessonMeta[]>;
  load(id: string): Promise<Lesson | null>;
  save(
    meta: Omit<LessonMeta, 'bytes'>,
    timeline: LessonTimeline,
    audio: Blob | null,
  ): Promise<LessonMeta>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;

  listDrafts(): Promise<DraftHeader[]>;
  writeDraftHeader(header: DraftHeader): Promise<void>;
  appendDraftOps(id: string, seq: number, ops: readonly TimelineOp[]): Promise<void>;
  appendDraftAudio(id: string, seq: number, chunk: Blob): Promise<void>;
  writeDraftDatasets(id: string, datasets: readonly LessonDataset[]): Promise<void>;
  loadDraft(id: string): Promise<Draft | null>;
  removeDraft(id: string): Promise<void>;
}

const K = {
  meta: (id: string) => `lesson/meta/${id}`,
  timeline: (id: string) => `lesson/timeline/${id}`,
  audio: (id: string) => `lesson/audio/${id}`,
  draftHeader: (id: string) => `draft/header/${id}`,
  draftOps: (id: string, seq?: number) =>
    `draft/ops/${id}/${seq === undefined ? '' : String(seq).padStart(8, '0')}`,
  draftAudio: (id: string, seq?: number) =>
    `draft/audio/${id}/${seq === undefined ? '' : String(seq).padStart(8, '0')}`,
  draftDatasets: (id: string) => `draft/datasets/${id}`,
};

const isMeta = (v: unknown): v is LessonMeta =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as LessonMeta).id === 'string' &&
  typeof (v as LessonMeta).title === 'string' &&
  typeof (v as LessonMeta).duration === 'number';

const isHeader = (v: unknown): v is DraftHeader =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as DraftHeader).id === 'string' &&
  typeof (v as DraftHeader).reached === 'number';

const toBytes = (v: unknown): Uint8Array | null => {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return null;
};

/** LessonRepository on top of any key/value StorageAdapter (IndexedDB in the browser). */
export class StorageLessonRepository implements LessonRepository {
  constructor(private readonly kv: StorageAdapter) {}

  async list(): Promise<LessonMeta[]> {
    const keys = await this.kv.keys('lesson/meta/');
    const metas = await Promise.all(keys.map((k) => this.kv.get(k)));
    return metas.filter(isMeta).sort((a, b) => b.createdAt - a.createdAt);
  }

  async load(id: string): Promise<Lesson | null> {
    const [meta, bytes, audio] = await Promise.all([
      this.kv.get(K.meta(id)),
      this.kv.get(K.timeline(id)),
      this.kv.get(K.audio(id)),
    ]);
    const raw = toBytes(bytes);
    if (!isMeta(meta) || !raw) return null;
    const timeline = await decodeTimeline(raw);
    return { meta, timeline, audio: audio instanceof Blob ? audio : null };
  }

  async save(
    meta: Omit<LessonMeta, 'bytes'>,
    timeline: LessonTimeline,
    audio: Blob | null,
  ): Promise<LessonMeta> {
    const bytes = await encodeTimeline(timeline);
    const full: LessonMeta = { ...meta, bytes: bytes.byteLength + (audio?.size ?? 0) };
    // Payload first, meta last: a lesson only appears in the library once complete.
    await this.kv.set(K.timeline(meta.id), bytes);
    if (audio) await this.kv.set(K.audio(meta.id), audio);
    await this.kv.set(K.meta(meta.id), full);
    return full;
  }

  async rename(id: string, title: string): Promise<void> {
    const meta = await this.kv.get(K.meta(id));
    if (!isMeta(meta)) return;
    await this.kv.set(K.meta(id), { ...meta, title });
  }

  async remove(id: string): Promise<void> {
    await this.kv.remove(K.meta(id));
    await Promise.all([this.kv.remove(K.timeline(id)), this.kv.remove(K.audio(id))]);
  }

  async listDrafts(): Promise<DraftHeader[]> {
    const keys = await this.kv.keys('draft/header/');
    const headers = await Promise.all(keys.map((k) => this.kv.get(k)));
    return headers.filter(isHeader).sort((a, b) => b.createdAt - a.createdAt);
  }

  writeDraftHeader(header: DraftHeader): Promise<void> {
    return this.kv.set(K.draftHeader(header.id), header);
  }

  appendDraftOps(id: string, seq: number, ops: readonly TimelineOp[]): Promise<void> {
    return this.kv.set(K.draftOps(id, seq), ops);
  }

  appendDraftAudio(id: string, seq: number, chunk: Blob): Promise<void> {
    return this.kv.set(K.draftAudio(id, seq), chunk);
  }

  writeDraftDatasets(id: string, datasets: readonly LessonDataset[]): Promise<void> {
    return this.kv.set(K.draftDatasets(id), datasets);
  }

  async loadDraft(id: string): Promise<Draft | null> {
    const header = await this.kv.get(K.draftHeader(id));
    if (!isHeader(header)) return null;
    const opKeys = (await this.kv.keys(K.draftOps(id))).sort();
    const audioKeys = (await this.kv.keys(K.draftAudio(id))).sort();
    const segments = await Promise.all(opKeys.map((k) => this.kv.get(k)));
    const chunks = await Promise.all(audioKeys.map((k) => this.kv.get(k)));
    const datasets = await this.kv.get(K.draftDatasets(id));
    const ops: TimelineOp[] = [];
    for (const s of segments) if (Array.isArray(s)) ops.push(...(s as TimelineOp[]));
    return {
      header,
      ops,
      datasets: Array.isArray(datasets) ? (datasets as LessonDataset[]) : [],
      audio: chunks.filter((c): c is Blob => c instanceof Blob),
    };
  }

  async removeDraft(id: string): Promise<void> {
    const keys = [
      ...(await this.kv.keys(K.draftOps(id))),
      ...(await this.kv.keys(K.draftAudio(id))),
      K.draftDatasets(id),
      K.draftHeader(id),
    ];
    for (const k of keys) await this.kv.remove(k);
  }
}
