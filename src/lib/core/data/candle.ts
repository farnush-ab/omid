/** One OHLCV bar. `time` is the bar open time in ms since epoch (UTC). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
