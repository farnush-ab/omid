'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only boundary: the chart touches canvas/window/IndexedDB, so it is never server-rendered.
 * The app opens on the lesson library; the chart workspace is reached through it.
 */
const LessonsShell = dynamic(() => import('../lessons/LessonsShell'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

export default function ChartClient() {
  return <LessonsShell />;
}
