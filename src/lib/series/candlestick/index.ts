import type { SeriesDefinition } from '@/lib/core';
import { renderCandles } from './candlestick-renderer';

export const candlestickSeries: SeriesDefinition = {
  id: 'candles',
  label: 'Candles',
  icon: 'M7 3v3M7 17v4M17 3v6M17 16v5M5 6h4v11H5zM15 9h4v7h-4z',
  create: (ctx) => ({
    id: 'series.candles',
    zIndex: 10,
    render: renderCandles,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
