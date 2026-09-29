export function formatPrice(value: number, precision: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(Math.max(0, Math.min(10, precision)));
}

export function formatSigned(value: number, precision: number): string {
  const s = formatPrice(Math.abs(value), precision);
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${s}`;
}

export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(decimals)}%`;
}

const UNITS: ReadonlyArray<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export function formatCompact(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  for (const [div, suffix] of UNITS) {
    if (abs >= div) return `${(value / div).toFixed(decimals)}${suffix}`;
  }
  return value.toFixed(abs < 10 ? Math.min(decimals + 2, 6) : decimals);
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human duration like TradingView's "3d 4h" / "45m". */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? '−' : '';
  if (abs >= DAY) {
    const d = Math.floor(abs / DAY);
    const h = Math.round((abs - d * DAY) / HOUR);
    return `${sign}${d}d${h ? ` ${h}h` : ''}`;
  }
  if (abs >= HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs - h * HOUR) / MINUTE);
    return `${sign}${h}h${m ? ` ${m}m` : ''}`;
  }
  return `${sign}${Math.round(abs / MINUTE)}m`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad2 = (n: number) => n.toString().padStart(2, '0');

/** Calendar fields in either local time (intraday bars) or UTC (daily and above). */
export interface CalendarParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hours: number;
  minutes: number;
}

export function calendarParts(time: number, utc: boolean): CalendarParts {
  const d = new Date(time);
  return utc
    ? {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
        day: d.getUTCDate(),
        weekday: d.getUTCDay(),
        hours: d.getUTCHours(),
        minutes: d.getUTCMinutes(),
      }
    : {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
        weekday: d.getDay(),
        hours: d.getHours(),
        minutes: d.getMinutes(),
      };
}

export const monthName = (m: number): string => MONTHS[m] ?? '';

/** Crosshair / tooltip label: "Tue 12 Mar '24 14:30" (time omitted for daily+). */
export function formatDateTime(time: number, utc: boolean, withTime: boolean): string {
  const p = calendarParts(time, utc);
  const date = `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month]} '${pad2(p.year % 100)}`;
  return withTime ? `${date}  ${pad2(p.hours)}:${pad2(p.minutes)}` : date;
}

export function formatTimeOfDay(time: number, utc: boolean): string {
  const p = calendarParts(time, utc);
  return `${pad2(p.hours)}:${pad2(p.minutes)}`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toDateTimeLocalValue(time: number): string {
  const p = calendarParts(time, false);
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}T${pad2(p.hours)}:${pad2(p.minutes)}`;
}

export function fromDateTimeLocalValue(value: string): number | null {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}
