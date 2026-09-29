'use client';

import { useEffect, useRef } from 'react';
import { ChartApp } from '@/lib/app';

/** Mounts the framework-agnostic chart app into a div and tears it down on unmount. */
export default function ChartSurface() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const app = new ChartApp(el);
    return () => app.destroy();
  }, []);
  return <div ref={ref} className="relative h-full w-full" data-testid="chart" />;
}
