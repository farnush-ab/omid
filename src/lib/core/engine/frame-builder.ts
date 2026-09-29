import { ENGINE_CONFIG } from '../config';
import type { Series } from '../contracts/series';
import type { SymbolInfo } from '../contracts/symbol';
import type { Theme } from '../contracts/theme';
import type { MinMax, RangeMinMax } from '../data/range-min-max';
import type { SeriesData } from '../data/series-data';
import type { ChartOptions } from '../model/chart-options';
import type { ChartCoordinates } from '../model/coordinates';
import { computeLayout } from '../model/layout';
import { fontString } from '../render/draw-utils';
import type { CrosshairState, FrameState } from '../render/frame';
import { generatePriceTicks, niceStep, type PriceTick } from '../scales/price-ticks';
import type { TimeWeights } from '../scales/time-ticks';
import { lastLessOrEqual } from '../util/binary-search';
import { formatPrice } from '../util/format';
import type { Timeframe } from '../time/timeframes';
import type { ViewportController } from './viewport-controller';

/** Extra price extents (e.g. drawings) considered by auto-scale unless "price chart only". */
export type PriceRangeContributor = (fromTime: number, toTime: number) => MinMax | null;

export interface FrameInputs {
  width: number;
  height: number;
  dpr: number;
  data: SeriesData;
  minMax: RangeMinMax;
  weights: TimeWeights;
  series: Series;
  viewport: ViewportController;
  coords: ChartCoordinates;
  options: ChartOptions;
  theme: Theme;
  symbol: SymbolInfo;
  timeframe: Timeframe;
  crosshair: CrosshairState | null;
  contributors: readonly PriceRangeContributor[];
  measureText: (text: string, font: string) => number;
}

const { priceAxis: AXIS, timeAxis: TIME_AXIS, volume: VOLUME } = ENGINE_CONFIG;

/** Builds the per-frame render state: layout, auto-scale, ticks. Pure w.r.t. its inputs. */
export class FrameBuilder {
  private axisWidth: number = AXIS.minWidth;

  /** Returns the frame, plus whether the price-axis width changed (needs a re-layout). */
  build(input: FrameInputs): { frame: FrameState; relayout: boolean } {
    const { data, viewport, options } = input;
    const { time, price } = viewport;
    const layout = computeLayout(
      input.width,
      input.height,
      this.axisWidth,
      options.volumeVisible ? options.volumePaneRatio : null,
    );
    time.width = layout.plot.width;
    price.top = layout.pricePane.y;
    price.height = layout.pricePane.height;
    price.marginTop = options.marginTop / 100;
    price.marginBottom = options.marginBottom / 100;

    const visible = time.visibleRange(data.length);
    const firstVisible = Math.max(0, Math.min(data.length - 1, Math.ceil(time.leftIndex)));
    if (data.length > 0) price.setBase(data.close[firstVisible]!);
    if (price.autoScale) this.autoScale(input, visible.from, visible.to);

    const precision =
      options.pricePrecision >= 0 ? options.pricePrecision : input.symbol.pricePrecision;
    const fmt = (p: number) => formatPrice(p, precision);
    const font = fontString(options.fontSize);
    const priceTicks = generatePriceTicks(price, AXIS.tickSpacingPx, fmt);
    const volumeMax = input.minMax.volumeMax(visible.from, visible.to);
    input.weights.setUtc(input.timeframe.dateOnly);
    const timeTicks =
      data.length > 0
        ? input.weights.ticks(
            visible.from,
            visible.to,
            (i) => time.indexToX(i),
            TIME_AXIS.labelSpacingPx,
          )
        : [];

    const relayout = this.measureAxis(priceTicks, data, fmt, font, input.measureText);
    const frame: FrameState = {
      width: input.width,
      height: input.height,
      dpr: input.dpr,
      layout,
      series: data,
      visible,
      timeScale: time,
      priceScale: price,
      volumeMax,
      coords: input.coords,
      theme: input.theme,
      options,
      symbol: input.symbol,
      timeframe: input.timeframe,
      precision,
      crosshair: input.crosshair,
      font,
      priceTicks,
      volumeTicks: layout.volumePane ? volumeTicks(layout.volumePane, volumeMax) : [],
      timeTicks,
      prevClose: options.showPrevCloseLine ? previousClose(data, input.timeframe) : null,
      formatPrice: fmt,
    };
    return { frame, relayout };
  }

  private autoScale(input: FrameInputs, from: number, to: number): void {
    let range = input.series.priceRange(from, to);
    if (!input.options.scalePriceChartOnly && input.data.length > 0) {
      const t0 = input.data.time[Math.max(0, from)]!;
      const t1 = input.data.time[Math.max(0, to)]!;
      for (const c of input.contributors) {
        const r = c(t0, t1);
        if (!r) continue;
        range = range ? { min: Math.min(range.min, r.min), max: Math.max(range.max, r.max) } : r;
      }
    }
    if (range) input.viewport.price.fitPrices(range.min, range.max);
  }

  private measureAxis(
    ticks: readonly PriceTick[],
    data: SeriesData,
    fmt: (p: number) => string,
    font: string,
    measure: (t: string, f: string) => number,
  ): boolean {
    let widest = 0;
    for (const t of ticks) widest = Math.max(widest, measure(t.label, font));
    if (data.length > 0)
      widest = Math.max(widest, measure(fmt(data.close[data.length - 1]!), font));
    const wanted = Math.max(AXIS.minWidth, Math.ceil(widest) + AXIS.padding * 2 + 4);
    if (wanted > this.axisWidth || wanted < this.axisWidth - 12) {
      this.axisWidth = wanted;
      return true;
    }
    return false;
  }
}

function volumeTicks(pane: { y: number; height: number }, volumeMax: number): PriceTick[] {
  if (volumeMax <= 0) return [];
  const pxPerUnit = (pane.height * VOLUME.headroom) / volumeMax;
  const step = niceStep((AXIS.tickSpacingPx * 0.9) / pxPerUnit);
  const out: PriceTick[] = [];
  for (let v = step; v <= volumeMax / VOLUME.headroom; v += step) {
    out.push({ y: pane.y + pane.height - v * pxPerUnit, price: v, label: '' });
  }
  return out;
}

/** Close of the previous session: previous local day for intraday, previous bar otherwise. */
function previousClose(data: SeriesData, tf: Timeframe): number | null {
  const n = data.length;
  if (n < 2) return null;
  if (tf.dateOnly) return data.close[n - 2]!;
  const d = new Date(data.time[n - 1]!);
  d.setHours(0, 0, 0, 0);
  const i = lastLessOrEqual(data.time, n, d.getTime() - 1);
  return i >= 0 ? data.close[i]! : null;
}
