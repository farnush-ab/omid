import {
  StorageLessonRepository,
  TimelineRecorder,
  type LessonMeta,
  type LessonRepository,
} from '@/lib/lessons';
import { IndexedDBStorage, MemoryStorage } from '@/lib/storage';
import { buildAudio } from './recording-session';

/** Lessons live in their own IndexedDB database, apart from chart preferences. */
export function createLessonRepository(): LessonRepository {
  try {
    if (typeof indexedDB !== 'undefined')
      return new StorageLessonRepository(new IndexedDBStorage(indexedDB, 'tradingchart-lessons'));
  } catch {
    /* private mode etc. */
  }
  return new StorageLessonRepository(new MemoryStorage());
}

/** Whether lessons survive a reload (false when only in-memory storage is available). */
export const lessonsArePersistent = (): boolean => typeof indexedDB !== 'undefined';

/**
 * Turns an unfinished recording (browser crash, closed tab) into a lesson from its last
 * autosave. The draft is only removed once the lesson is stored.
 */
export async function recoverDraft(
  repo: LessonRepository,
  id: string,
  title: string,
): Promise<LessonMeta | null> {
  const draft = await repo.loadDraft(id);
  if (!draft) return null;
  const ops = [...draft.ops].sort((a, b) => a.t - b.t);
  const duration = Math.max(draft.header.reached, ops.at(-1)?.t ?? 0);
  const rec = new TimelineRecorder({ now: () => duration });
  rec.begin(draft.header.initial);
  const timeline = { ...rec.finish(duration, draft.datasets), ops };
  const audio = await buildAudio(draft.audio, draft.header.audioType, duration);
  const meta = await repo.save(
    {
      id,
      title: title.trim() || 'Recovered lesson',
      createdAt: draft.header.createdAt,
      duration,
      audioType: audio ? draft.header.audioType : null,
    },
    timeline,
    audio,
  );
  await repo.removeDraft(id);
  return meta;
}
