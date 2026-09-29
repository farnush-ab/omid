import { Registry, type Clock, type DataProvider } from '@/lib/core';
import type { FetchFn } from './binance/binance-provider';

export interface DataProviderDeps {
  readonly clock: Clock;
  readonly fetch: FetchFn;
}

export interface DataProviderDefinition {
  readonly id: string;
  readonly label: string;
  create(deps: DataProviderDeps): DataProvider;
}

export const dataProviderRegistry = new Registry<DataProviderDefinition>('DataProviderRegistry');
