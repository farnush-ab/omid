'use client';

import dynamic from 'next/dynamic';

/** Client-only boundary: the chart touches canvas/window/IndexedDB, so it is never server-rendered. */
const ChartWorkspace = dynamic(() => import('./ChartWorkspace'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

export default function ChartClient() {
  return <ChartWorkspace />;
}
