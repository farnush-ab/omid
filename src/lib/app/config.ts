import type { TimeframeId } from '@/lib/core';

/** Application-level constants. */
export const APP_CONFIG = {
  defaultSymbol: 'BTCUSDT',
  defaultTimeframe: '1h' as TimeframeId,
  initialBars: 1000,
  historyPageBars: 1000,
  persistDebounceMs: 400,
  intervalTyperTimeoutMs: 4000,
  storageKeys: {
    appState: 'app-state',
    chartSettings: 'chart-settings',
    themes: 'themes',
    toolDefaults: 'tool-defaults',
    drawings: (symbol: string) => `drawings:${symbol}`,
  },
} as const;
