import './register';

export { SyntheticProvider, SYNTHETIC_EPOCH } from './synthetic/synthetic-provider';
export { BinanceProvider, type FetchFn } from './binance/binance-provider';
export {
  BINANCE_HOSTS,
  BINANCE_INTERVALS,
  BINANCE_MAX_LIMIT,
  klinesQuery,
  parseKlines,
} from './binance/klines';
export { FallbackProvider } from './fallback-provider';
export {
  dataProviderRegistry,
  type DataProviderDefinition,
  type DataProviderDeps,
} from './registry';
export { DEFAULT_PROVIDER_ID, FALLBACK_PROVIDER_ID } from './register';
export { SYMBOLS, symbolInfo, searchSymbols } from './symbols';
