import { DAY_MS, HOUR_MS, MINUTE_MS, MONTH_MS_AVG, WEEK_MS } from './constants';

export const TIMEFRAME_IDS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '1D',
  '1W',
  '1M',
] as const;
export type TimeframeId = (typeof TIMEFRAME_IDS)[number];

export type TimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface Timeframe {
  readonly id: TimeframeId;
  readonly label: string;
  readonly unit: TimeUnit;
  readonly count: number;
  /** Nominal duration (average for months). */
  readonly ms: number;
  /** True for timeframes whose bars are calendar dates (1D and above). */
  readonly dateOnly: boolean;
}

const UNIT_MS: Record<TimeUnit, number> = {
  minute: MINUTE_MS,
  hour: HOUR_MS,
  day: DAY_MS,
  week: WEEK_MS,
  month: MONTH_MS_AVG,
};

function tf(id: TimeframeId, unit: TimeUnit, count: number, label: string): Timeframe {
  return {
    id,
    unit,
    count,
    label,
    ms: UNIT_MS[unit] * count,
    dateOnly: unit === 'day' || unit === 'week' || unit === 'month',
  };
}

export const TIMEFRAMES: Readonly<Record<TimeframeId, Timeframe>> = {
  '1m': tf('1m', 'minute', 1, '1m'),
  '3m': tf('3m', 'minute', 3, '3m'),
  '5m': tf('5m', 'minute', 5, '5m'),
  '15m': tf('15m', 'minute', 15, '15m'),
  '30m': tf('30m', 'minute', 30, '30m'),
  '1h': tf('1h', 'hour', 1, '1H'),
  '2h': tf('2h', 'hour', 2, '2H'),
  '4h': tf('4h', 'hour', 4, '4H'),
  '1D': tf('1D', 'day', 1, 'D'),
  '1W': tf('1W', 'week', 1, 'W'),
  '1M': tf('1M', 'month', 1, 'M'),
};

export const getTimeframe = (id: TimeframeId): Timeframe => TIMEFRAMES[id];

export const isTimeframeId = (v: unknown): v is TimeframeId =>
  typeof v === 'string' && (TIMEFRAME_IDS as readonly string[]).includes(v);

/** Ordering helper: negative when a is finer than b. */
export const compareTimeframes = (a: TimeframeId, b: TimeframeId): number =>
  TIMEFRAMES[a].ms - TIMEFRAMES[b].ms;

/**
 * Parses what a user types in the timeframe quick-switch: "5", "15m", "1h", "60", "240", "4H",
 * "D", "1D", "W", "M". Returns null for anything not supported.
 */
export function parseTimeframeInput(input: string): TimeframeId | null {
  const s = input.trim();
  const m = s.match(/^(\d*)\s*([a-zA-Z]?)$/);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  const u = m[2] ?? '';
  let unit: TimeUnit;
  let count = n;
  if (u === '' || u === 'm') {
    if (!m[1]) return null;
    unit = 'minute';
    if (u === '' && n >= 60 && n % 60 === 0) {
      unit = 'hour';
      count = n / 60;
    }
  } else if (u === 'h' || u === 'H') unit = 'hour';
  else if (u === 'd' || u === 'D') unit = 'day';
  else if (u === 'w' || u === 'W') unit = 'week';
  else if (u === 'M') unit = 'month';
  else return null;
  const found = TIMEFRAME_IDS.find(
    (id) => TIMEFRAMES[id].unit === unit && TIMEFRAMES[id].count === count,
  );
  return found ?? null;
}
