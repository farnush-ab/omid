import { candlestickSeries } from './candlestick';
import { seriesRegistry } from './registry';

/** The single place where chart types are registered. Add new series modules here. */
seriesRegistry.register(candlestickSeries);

export const DEFAULT_SERIES_ID = candlestickSeries.id;
