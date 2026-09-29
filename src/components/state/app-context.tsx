'use client';

import { createContext, useContext } from 'react';
import type { ChartApp } from '@/lib/app';

export const AppContext = createContext<ChartApp | null>(null);

/** The mounted ChartApp. Only use below <AppContext.Provider> once the app exists. */
export function useApp(): ChartApp {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp() called outside of a mounted chart');
  return app;
}
