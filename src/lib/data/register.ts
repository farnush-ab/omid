import { BinanceProvider } from './binance/binance-provider';
import { dataProviderRegistry } from './registry';
import { SyntheticProvider } from './synthetic/synthetic-provider';

/** The single place where data providers are registered. */
dataProviderRegistry
  .register({ id: 'binance', label: 'Binance', create: (d) => new BinanceProvider(d.fetch) })
  .register({
    id: 'synthetic',
    label: 'Synthetic (offline)',
    create: (d) => new SyntheticProvider({ clock: d.clock }),
  });

export const DEFAULT_PROVIDER_ID = 'binance';
export const FALLBACK_PROVIDER_ID = 'synthetic';
