import type { MinMax, RangeMinMax } from '../data/range-min-max';
import type { SeriesData } from '../data/series-data';
import type { LayerRenderer } from '../render/frame';

/** A price series (chart type). Only Candlestick is registered today. */
export interface Series extends LayerRenderer {
  /** Price extent over bar indices [from, to] for auto-scale. */
  priceRange(from: number, to: number): MinMax | null;
  dispose?(): void;
}

export interface SeriesContext {
  readonly data: () => SeriesData;
  readonly minMax: () => RangeMinMax;
}

export interface SeriesDefinition {
  readonly id: string;
  readonly label: string;
  /** SVG path data (24×24 viewBox). */
  readonly icon: string;
  create(ctx: SeriesContext): Series;
}
