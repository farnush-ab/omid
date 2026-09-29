/** Central engine constants. No magic numbers elsewhere in core. */
export const ENGINE_CONFIG = {
  barSpacing: { default: 8, min: 0.02, max: 120 },
  /** Bars of empty space kept to the right of the last bar by default. */
  rightMarginBars: 8,
  /** Minimum bars that must remain visible when scrolling to either end. */
  minVisibleBars: 3,
  /** Bars from the left edge that trigger a lazy history request. */
  historyThresholdBars: 60,
  /** Below this bar spacing (css px) candles are rendered by pixel-column decimation. */
  lodBarSpacing: 2,
  candleBodyRatio: 0.78,
  priceAxis: { minWidth: 56, padding: 8, tickSpacingPx: 42 },
  timeAxis: { height: 28, labelSpacingPx: 88 },
  volume: { defaultRatio: 0.2, minRatio: 0.08, maxRatio: 0.5, headroom: 0.9 },
  priceMargins: { top: 0.1, bottom: 0.08 },
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
    size: 11,
  },
  zoom: { wheelStep: 0.0015, maxWheelFactor: 1.5, axisDragSensitivity: 0.006 },
  touch: { longPressMs: 450, moveTolerancePx: 6 },
  handles: { radius: 5, hitRadius: 9 },
  hitTolerancePx: 6,
  labelPadding: { x: 6, y: 3 },
  animation: { scrollMs: 300 },
} as const;
