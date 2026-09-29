import type { SymbolInfo } from '../contracts/symbol';
import type { Theme } from '../contracts/theme';
import type { SeriesData } from '../data/series-data';
import type { ChartOptions } from '../model/chart-options';
import type { ChartCoordinates } from '../model/coordinates';
import type { ChartLayout } from '../model/layout';
import type { PriceScale } from '../scales/price-scale';
import type { PriceTick } from '../scales/price-ticks';
import type { TimeTick } from '../scales/time-ticks';
import type { TimeScale } from '../scales/time-scale';
import type { Timeframe } from '../time/timeframes';

export interface CrosshairState {
  readonly x: number;
  readonly y: number;
  /** Bar index under the crosshair (may be beyond the data). */
  readonly index: number;
  readonly time: number;
  readonly price: number;
  readonly region: 'price-pane' | 'volume-pane';
}

/** Everything a renderer needs for one frame. Built once per frame by the engine. */
export interface FrameState {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly layout: ChartLayout;
  readonly series: SeriesData;
  readonly visible: { readonly from: number; readonly to: number };
  readonly timeScale: TimeScale;
  readonly priceScale: PriceScale;
  readonly volumeMax: number;
  readonly coords: ChartCoordinates;
  readonly theme: Theme;
  readonly options: ChartOptions;
  readonly symbol: SymbolInfo;
  readonly timeframe: Timeframe;
  readonly precision: number;
  readonly crosshair: CrosshairState | null;
  readonly font: string;
  readonly priceTicks: readonly PriceTick[];
  readonly volumeTicks: readonly PriceTick[];
  readonly timeTicks: readonly TimeTick[];
  /** Previous session close (for the prev-close line), if known. */
  readonly prevClose: number | null;
  formatPrice(price: number): string;
}

/** A unit of drawing on one layer. Plugins implement this. */
export interface LayerRenderer {
  readonly id: string;
  /** Lower draws first within a layer. */
  readonly zIndex: number;
  render(ctx: CanvasRenderingContext2D, frame: FrameState): void;
}
