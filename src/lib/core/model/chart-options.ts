import type { LineStyle } from '../contracts/settings-schema';
import type { PriceScaleMode } from '../scales/price-scale';
import { ENGINE_CONFIG } from '../config';

export type CrosshairMode = 'full' | 'dot' | 'arrow';
export type BackgroundType = 'solid' | 'gradient';

/**
 * Behavioural chart options (colours live in the Theme). Flat primitives on purpose: the
 * settings dialog binds schema fields to these keys directly.
 */
export interface ChartOptions {
  // Symbol
  showBody: boolean;
  showBorders: boolean;
  showWicks: boolean;
  /** -1 = auto (from symbol tick size). */
  pricePrecision: number;
  // Status line
  showStatusSymbol: boolean;
  showStatusOHLC: boolean;
  showStatusChange: boolean;
  showStatusVolume: boolean;
  // Scales
  autoScale: boolean;
  scaleMode: PriceScaleMode;
  invertScale: boolean;
  lockScale: boolean;
  scalePriceChartOnly: boolean;
  showLastPriceLine: boolean;
  showLastPriceLabel: boolean;
  showPrevCloseLine: boolean;
  // Appearance
  backgroundType: BackgroundType;
  gridVertical: boolean;
  gridHorizontal: boolean;
  crosshairMode: CrosshairMode;
  crosshairLineStyle: LineStyle;
  watermarkVisible: boolean;
  watermarkText: string;
  fontSize: number;
  // Canvas
  volumeVisible: boolean;
  volumePaneRatio: number;
  rightMargin: number;
  marginTop: number;
  marginBottom: number;
  hiDpi: boolean;
}

export const DEFAULT_CHART_OPTIONS: Readonly<ChartOptions> = {
  showBody: true,
  showBorders: true,
  showWicks: true,
  pricePrecision: -1,
  showStatusSymbol: true,
  showStatusOHLC: true,
  showStatusChange: true,
  showStatusVolume: true,
  autoScale: true,
  scaleMode: 'linear',
  invertScale: false,
  lockScale: false,
  scalePriceChartOnly: false,
  showLastPriceLine: true,
  showLastPriceLabel: true,
  showPrevCloseLine: false,
  backgroundType: 'solid',
  gridVertical: true,
  gridHorizontal: true,
  crosshairMode: 'full',
  crosshairLineStyle: 'dashed',
  watermarkVisible: false,
  watermarkText: '',
  fontSize: ENGINE_CONFIG.font.size,
  volumeVisible: true,
  volumePaneRatio: ENGINE_CONFIG.volume.defaultRatio,
  rightMargin: ENGINE_CONFIG.rightMarginBars,
  marginTop: ENGINE_CONFIG.priceMargins.top * 100,
  marginBottom: ENGINE_CONFIG.priceMargins.bottom * 100,
  hiDpi: true,
};
