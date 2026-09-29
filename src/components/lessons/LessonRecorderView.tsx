'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserAudioCapture,
  MicError,
  RecordingSession,
  requestMicrophone,
  type AppDependencies,
  type ChartApp,
  type RecordingStatus,
} from '@/lib/app';
import { createIdGenerator } from '@/lib/core';
import { CapturingProvider, type LessonRepository } from '@/lib/lessons';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { formatDuration } from './format';

const ChartWorkspace = dynamic(() => import('../chart/ChartWorkspace'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

interface LessonRecorderViewProps {
  readonly repository: LessonRepository;
  readonly onExit: () => void;
}

type Modal =
  | { readonly kind: 'mic-error'; readonly message: string }
  | { readonly kind: 'name' }
  | { readonly kind: 'discard' };

/** The full chart workspace plus the recorder bar (start, pause/resume, stop & name, discard). */
export function LessonRecorderView({ repository, onExit }: LessonRecorderViewProps) {
  const captureRef = useRef<CapturingProvider | null>(null);
  const [app, setApp] = useState<ChartApp | null>(null);
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [withVoice, setWithVoice] = useState(true);
  const [modal, setModal] = useState<Modal | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const pushToast = useUiStore((s) => s.pushToast);

  const wrapDeps = useCallback((deps: AppDependencies) => {
    const provider = new CapturingProvider(deps.provider);
    captureRef.current = provider;
    return { ...deps, provider };
  }, []);

  const begin = async (voice: boolean) => {
    const provider = captureRef.current;
    if (!app || !provider) return;
    setModal(null);
    let audio: BrowserAudioCapture | null = null;
    if (voice) {
      try {
        audio = new BrowserAudioCapture(await requestMicrophone());
      } catch (e) {
        const message = e instanceof MicError ? e.message : 'The microphone could not be started.';
        setModal({ kind: 'mic-error', message });
        return;
      }
    }
    const s = new RecordingSession({
      app,
      repository,
      provider,
      clock: app.deps.clock,
      timer: app.deps.runtime.timer,
      newId: createIdGenerator(app.deps.rng, 'lesson-'),
      audio,
    });
    s.events.on('status:changed', ({ status: next }) => setStatus(next));
    s.events.on('mic:lost', () =>
      setWarning('Microphone disconnected — recording paused. Stop to save what you have.'),
    );
    s.events.on('autosave:failed', ({ message }) =>
      setWarning(`Autosave failed (${message}). Keep this tab open and stop to save.`),
    );
    setSession(s);
    try {
      await s.start();
    } catch (e) {
      setSession(null);
      const message = e instanceof MicError ? e.message : 'Recording could not be started.';
      setModal({ kind: 'mic-error', message });
    }
  };

  const active = status === 'recording' || status === 'paused' || status === 'saving';

  // Never lose work silently: warn before leaving, autosave when the tab is hidden.
  useEffect(() => {
    if (!session || !active) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      void session.autosave();
      e.preventDefault();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') void session.autosave();
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', hidden);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', hidden);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [session, active]);

  useEffect(() => () => session?.destroy(), [session]);

  const openStop = () => {
    session?.pause();
    setTitle('');
    setModal({ kind: 'name' });
  };

  const save = async () => {
    if (!session) return;
    setModal(null);
    try {
      const meta = await session.stop(title);
      pushToast(`Saved "${meta.title}" (${formatDuration(meta.duration)})`, 'info');
      onExit();
    } catch (e) {
      setWarning(
        `Saving failed (${e instanceof Error ? e.message : String(e)}). The recording is kept as a draft — try again or recover it from the library.`,
      );
    }
  };

  const discard = async () => {
    setModal(null);
    await session?.discard();
    onExit();
  };

  const bar = (
    <RecorderBar
      status={status}
      session={session}
      ready={app !== null}
      withVoice={withVoice}
      onToggleVoice={() => setWithVoice((v) => !v)}
      onStart={() => void begin(withVoice)}
      onPause={() => session?.pause()}
      onResume={() => session?.resume()}
      onStop={openStop}
      onDiscard={() => setModal({ kind: 'discard' })}
      onExit={onExit}
      warning={warning}
      onDismissWarning={() => setWarning(null)}
    />
  );

  return (
    <>
      <ChartWorkspace wrapDeps={wrapDeps} onApp={setApp} footer={bar} />
      {modal?.kind === 'mic-error' ? (
        <Dialog
          title="Microphone unavailable"
          width={440}
          onClose={() => setModal(null)}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => void begin(false)}>
                Record without voice
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-[13px]">
            {modal.message} Check the browser&apos;s site permissions and your input device, or
            record the chart without voice.
          </p>
        </Dialog>
      ) : null}
      {modal?.kind === 'name' ? (
        <Dialog
          title="Save lesson"
          width={440}
          initialFocus="input"
          onClose={() => setModal(null)}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setModal(null)}>Keep recording</Button>
              <Button variant="primary" onClick={() => void save()}>
                Save lesson
              </Button>
            </>
          }
        >
          <form
            className="px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="mb-1 block text-[13px] text-muted" htmlFor="lesson-title">
              Lesson title
            </label>
            <input
              id="lesson-title"
              value={title}
              maxLength={120}
              placeholder="Untitled lesson"
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-chart px-2 text-[14px] text-fg outline-none focus:border-accent"
            />
            <p className="mt-2 text-[12px] text-muted">
              Length: {formatDuration(session?.elapsed ?? 0)}. Paused time is not included.
            </p>
          </form>
        </Dialog>
      ) : null}
      {modal?.kind === 'discard' ? (
        <Dialog
          title="Discard recording?"
          width={420}
          onClose={() => setModal(null)}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => void discard()}>
                Discard
              </Button>
            </>
          }
        >
          <p className="px-5 py-4 text-[13px]">
            The recording and its voice track will be permanently deleted.
          </p>
        </Dialog>
      ) : null}
    </>
  );
}

interface RecorderBarProps {
  readonly status: RecordingStatus;
  readonly session: RecordingSession | null;
  readonly ready: boolean;
  readonly withVoice: boolean;
  readonly warning: string | null;
  onToggleVoice(): void;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onStop(): void;
  onDiscard(): void;
  onExit(): void;
  onDismissWarning(): void;
}

function Elapsed({ session, running }: { session: RecordingSession; running: boolean }) {
  const [ms, setMs] = useState(session.elapsed);
  const ref = useRef(session);
  useEffect(() => {
    ref.current = session;
    if (!running) return;
    const h = window.setInterval(() => setMs(ref.current.elapsed), 250);
    return () => window.clearInterval(h);
  }, [session, running]);
  return <span className="tabular-nums">{formatDuration(running ? ms : session.elapsed)}</span>;
}

function RecorderBar(p: RecorderBarProps) {
  const { status, session } = p;
  return (
    <div
      role="region"
      aria-label="Lesson recorder"
      className="flex shrink-0 flex-col border-t border-line bg-panel text-[13px]"
    >
      {p.warning ? (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-down"
        >
          <span className="flex-1">{p.warning}</span>
          <button type="button" className="text-muted hover:text-fg" onClick={p.onDismissWarning}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex h-12 items-center gap-2 px-3">
        {status === 'idle' || status === 'starting' ? (
          <>
            <Button variant="ghost" onClick={p.onExit}>
              <Icon name="chevronLeft" size={16} />
              Library
            </Button>
            <span className="hidden text-muted sm:inline">
              Set up the chart, then start recording.
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              aria-pressed={p.withVoice}
              onClick={p.onToggleVoice}
              title={p.withVoice ? 'Voice will be recorded' : 'Recording without voice'}
            >
              <Icon name={p.withVoice ? 'mic' : 'micOff'} size={16} />
              {p.withVoice ? 'Voice on' : 'Voice off'}
            </Button>
            <Button
              variant="primary"
              disabled={!p.ready || status === 'starting'}
              onClick={p.onStart}
            >
              <Icon name="record" size={16} className="text-down" />
              {status === 'starting' ? 'Starting…' : 'Start recording'}
            </Button>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 font-medium" aria-live="polite">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${status === 'recording' ? 'animate-pulse bg-down' : 'bg-muted'}`}
              />
              {status === 'recording' ? 'Recording' : status === 'paused' ? 'Paused' : 'Saving…'}
            </span>
            {session ? <Elapsed session={session} running={status === 'recording'} /> : null}
            {session && !session.hasAudio ? <span className="text-muted">· no voice</span> : null}
            <div className="flex-1" />
            {status === 'recording' ? (
              <Button onClick={p.onPause}>
                <Icon name="pause" size={16} />
                Pause
              </Button>
            ) : null}
            {status === 'paused' && !session?.microphoneLost ? (
              <Button onClick={p.onResume}>
                <Icon name="record" size={16} className="text-down" />
                Resume
              </Button>
            ) : null}
            <Button variant="primary" disabled={status === 'saving'} onClick={p.onStop}>
              <Icon name="stop" size={16} />
              Stop
            </Button>
            <Button variant="danger" disabled={status === 'saving'} onClick={p.onDiscard}>
              <Icon name="trash" size={16} />
              Discard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
