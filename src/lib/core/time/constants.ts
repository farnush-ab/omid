export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
/** Average month length, used only for extrapolating beyond the data. */
export const MONTH_MS_AVG = 30.436875 * DAY_MS;
/** 1970-01-05 was the first Monday after the epoch (Binance weeks start Monday 00:00 UTC). */
export const FIRST_MONDAY_MS = 4 * DAY_MS;
