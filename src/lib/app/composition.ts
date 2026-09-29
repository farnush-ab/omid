import {
  createRng,
  type Clock,
  type DataProvider,
  type EngineRuntime,
  type Rng,
  type StorageAdapter,
} from '@/lib/core';
import {
  FallbackProvider,
  FALLBACK_PROVIDER_ID,
  DEFAULT_PROVIDER_ID,
  dataProviderRegistry,
  type FetchFn,
} from '@/lib/data';
import { IndexedDBStorage, LocalStorageStorage, MemoryStorage } from '@/lib/storage';
import { createBrowserRuntime, systemClock } from './browser-runtime';

/** Everything the app needs from the outside world. Swap implementations here (DI). */
export interface AppDependencies {
  readonly runtime: EngineRuntime;
  readonly clock: Clock;
  readonly rng: Rng;
  readonly storage: StorageAdapter;
  readonly provider: DataProvider;
}

export interface BrowserDependencyOptions {
  /** 'binance' (with synthetic fallback) or 'synthetic'. */
  readonly providerId?: string;
  readonly onFallback?: (error: unknown) => void;
}

function pickStorage(): StorageAdapter {
  try {
    if (typeof indexedDB !== 'undefined') return new IndexedDBStorage(indexedDB);
  } catch {
    /* private mode etc. */
  }
  try {
    if (typeof localStorage !== 'undefined') return new LocalStorageStorage(localStorage);
  } catch {
    /* storage disabled */
  }
  return new MemoryStorage();
}

/** The composition root for the browser. */
export function createBrowserDependencies(opts: BrowserDependencyOptions = {}): AppDependencies {
  const clock = systemClock;
  const fetchFn: FetchFn = (input, init) => fetch(input, init);
  const deps = { clock, fetch: fetchFn };
  const id =
    opts.providerId && dataProviderRegistry.has(opts.providerId)
      ? opts.providerId
      : DEFAULT_PROVIDER_ID;
  const fallback = dataProviderRegistry.require(FALLBACK_PROVIDER_ID).create(deps);
  const primary = dataProviderRegistry.require(id).create(deps);
  const provider =
    id === FALLBACK_PROVIDER_ID
      ? primary
      : new FallbackProvider(primary, fallback, opts.onFallback);
  return {
    runtime: createBrowserRuntime(),
    clock,
    rng: createRng(clock.now() >>> 0),
    storage: pickStorage(),
    provider,
  };
}

/**
 * Dependencies of a lesson player: market data only from the lesson, in-memory storage (the
 * student's session never touches saved preferences or drawings) and a fixed RNG seed.
 */
export function createPlaybackDependencies(provider: DataProvider): AppDependencies {
  return {
    runtime: createBrowserRuntime(),
    clock: systemClock,
    rng: createRng(1),
    storage: new MemoryStorage(),
    provider,
  };
}
