'use client';

import { useState } from 'react';
import { createLessonRepository } from '@/lib/app';
import { LessonLibrary } from './LessonLibrary';
import { LessonPlayerView } from './LessonPlayerView';
import { LessonRecorderView } from './LessonRecorderView';

type Screen =
  | { readonly kind: 'library' }
  | { readonly kind: 'record' }
  | { readonly kind: 'play'; readonly id: string };

/** Top-level navigation: the lesson library is the start screen. */
export default function LessonsShell() {
  const [repository] = useState(createLessonRepository);
  const [screen, setScreen] = useState<Screen>({ kind: 'library' });
  const toLibrary = () => setScreen({ kind: 'library' });

  switch (screen.kind) {
    case 'record':
      return <LessonRecorderView repository={repository} onExit={toLibrary} />;
    case 'play':
      return <LessonPlayerView repository={repository} lessonId={screen.id} onExit={toLibrary} />;
    default:
      return (
        <LessonLibrary
          repository={repository}
          onRecord={() => setScreen({ kind: 'record' })}
          onOpen={(id) => setScreen({ kind: 'play', id })}
        />
      );
  }
}
