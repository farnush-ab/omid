'use client';

import dynamic from 'next/dynamic';

/** Client-only boundary: the chart touches canvas/window, so it is never server-rendered. */
const ChartSurface = dynamic(() => import('./ChartSurface'), { ssr: false });

export default function ChartClient() {
  return <ChartSurface />;
}
