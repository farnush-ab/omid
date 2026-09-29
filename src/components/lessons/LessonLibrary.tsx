'use client';

import { useEffect, useState } from 'react';
import { lessonsArePersistent, recoverDraft } from '@/lib/app';
import type { DraftHeader, LessonMeta, LessonRepository } from '@/lib/lessons';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { Toasts } from '../overlays/Toasts';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { formatBytes, formatDate, formatDuration } from './format';

interface LessonLibraryProps {
  readonly repository: LessonRepository;
  readonly onRecord: () => void;
  readonly onOpen: (id: string) => void;
}

type Confirm =
  | { readonly kind: 'delete'; readonly lesson: LessonMeta }
  | { readonly kind: 'discard-draft'; readonly draft: DraftHeader };

/** Start screen: saved lessons, unfinished recordings to recover, and "New Recording". */
export function LessonLibrary({ repository, onRecord, onOpen }: LessonLibraryProps) {
  useThemeCssVars();
  const [lessons, setLessons] = useState<LessonMeta[] | null>(null);
  const [drafts, setDrafts] = useState<DraftHeader[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((r) => r + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([repository.list(), repository.listDrafts()])
      .then(([l, d]) => {
        if (!alive) return;
        setLessons(l);
        setDrafts(d);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(`Could not read saved lessons: ${e instanceof Error ? e.message : String(e)}`);
        setLessons([]);
      });
    return () => {
      alive = false;
    };
  }, [repository, revision]);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(`${failure}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const saveRename = () => {
    if (!renaming) return;
    const { id, title } = renaming;
    setRenaming(null);
    if (title.trim()) void run(() => repository.rename(id, title.trim()), 'Rename failed');
  };

  return (
    <div className="flex h-full w-full flex-col overflow-auto bg-chart text-fg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
        <h1 className="text-[16px] font-semibold">Lessons</h1>
        <div className="flex-1" />
        <Button variant="primary" onClick={onRecord} disabled={busy}>
          <Icon name="record" size={16} />
          New Recording
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        {!lessonsArePersistent() ? (
          <p className="mb-4 rounded-lg border border-line bg-panel px-4 py-3 text-[13px] text-down">
            This browser does not allow local storage for this site. Lessons will be lost when the
            page is closed.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-lg border border-down/50 bg-panel px-4 py-3 text-[13px] text-down"
          >
            <span className="flex-1">{error}</span>
            <IconButton icon="close" label="Dismiss" onClick={() => setError(null)} />
          </p>
        ) : null}

        {drafts.length > 0 ? (
          <section aria-label="Unfinished recordings" className="mb-8">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
              Unfinished recordings
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <Icon name="info" size={18} className="text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Recording interrupted</div>
                    <div className="text-muted">
                      {formatDate(d.createdAt)} · {formatDuration(d.reached)} saved
                      {d.audioType ? '' : ' · no voice'}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          recoverDraft(repository, d.id, `Recovered ${formatDate(d.createdAt)}`),
                        'Recovery failed',
                      )
                    }
                  >
                    Recover
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'discard-draft', draft: d })}
                  >
                    Discard
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Saved lessons">
          {lessons === null ? (
            <p className="text-[13px] text-muted">Loading…</p>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-16 text-center">
              <p className="text-[14px] font-medium">No lessons yet</p>
              <p className="max-w-sm text-[13px] text-muted">
                Record your voice while you work on the chart. Students can replay it, pause at any
                moment and explore the chart themselves.
              </p>
              <Button variant="primary" onClick={onRecord}>
                <Icon name="record" size={16} />
                New Recording
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
              {lessons.map((l) => (
                <li key={l.id} className="group flex items-center gap-3 px-2 text-[13px]">
                  {renaming?.id === l.id ? (
                    <form
                      className="flex flex-1 items-center gap-2 py-2 pl-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveRename();
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Lesson title"
                        value={renaming.title}
                        maxLength={120}
                        onChange={(e) => setRenaming({ id: l.id, title: e.target.value })}
                        onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                        className="h-8 flex-1 rounded-md border border-line bg-chart px-2 text-fg outline-none focus:border-accent"
                      />
                      <Button type="submit" variant="primary">
                        Save
                      </Button>
                      <Button onClick={() => setRenaming(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpen(l.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-hover"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                          <Icon name="play" size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{l.title}</span>
                          <span className="block text-muted">
                            {formatDate(l.createdAt)}
                            {l.audioType ? '' : ' · no voice'} · {formatBytes(l.bytes)}
                          </span>
                        </span>
                        <span className="tabular-nums text-muted">
                          {formatDuration(l.duration)}
                        </span>
                      </button>
                      <IconButton
                        icon="edit"
                        label="Rename"
                        onClick={() => setRenaming({ id: l.id, title: l.title })}
                      />
                      <IconButton
                        icon="trash"
                        label="Delete"
                        onClick={() => setConfirm({ kind: 'delete', lesson: l })}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Toasts />
      {confirm ? (
        <Dialog
          title={confirm.kind === 'delete' ? 'Delete lesson?' : 'Discard recording?'}
          width={420}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const c = confirm;
                  setConfirm(null);
                  void run(
                    () =>
                      c.kind === 'delete'
                        ? repository.remove(c.lesson.id)
                        : repository.removeDraft(c.draft.id),
                    'Delete failed',
                  );
                }}
              >
                {confirm.kind === 'delete' ? 'Delete' : 'Discard'}
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-[13px]">
            {confirm.kind === 'delete'
              ? `"${confirm.lesson.title}" will be permanently deleted.`
              : 'The unfinished recording will be permanently deleted.'}
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
