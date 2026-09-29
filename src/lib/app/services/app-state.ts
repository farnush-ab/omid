import { isTimeframeId, type TimeframeId } from '@/lib/core';
import type { VersionedStore } from '@/lib/storage';
import { APP_CONFIG } from '../config';

export interface AppState {
  readonly symbol: string;
  readonly timeframe: TimeframeId;
}

function validate(data: unknown): AppState | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.symbol !== 'string' ||
    !/^[A-Z0-9]{2,20}$/.test(d.symbol) ||
    !isTimeframeId(d.timeframe)
  )
    return null;
  return { symbol: d.symbol, timeframe: d.timeframe };
}

export const loadAppState = (store: VersionedStore) =>
  store.load(APP_CONFIG.storageKeys.appState, 'appState', validate);

export const saveAppState = (store: VersionedStore, state: AppState) =>
  store.save(APP_CONFIG.storageKeys.appState, 'appState', state);
