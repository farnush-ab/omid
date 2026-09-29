import { firstGreaterOrEqual, floorToStep } from '@/lib/core';

export type Side = 'long' | 'short';

export interface PositionLevels {
  readonly side: Side;
  readonly entry: number;
  readonly target: number;
  readonly stop: number;
}

export interface RiskParams {
  readonly accountSize: number;
  readonly riskMode: 'percent' | 'amount';
  readonly risk: number;
  /** Contract size: 1 lot = lotSize units. */
  readonly lotSize: number;
  readonly leverage: number;
  readonly tickSize: number;
  readonly qtyStep: number;
}

export interface PositionStats {
  readonly targetDistance: number;
  readonly targetTicks: number;
  readonly targetPercent: number;
  readonly stopDistance: number;
  readonly stopTicks: number;
  readonly stopPercent: number;
  /** Reward / risk. */
  readonly riskReward: number;
  /** Money at risk (account currency). */
  readonly riskAmount: number;
  /** Position size in units of the base asset. */
  readonly quantity: number;
  /** Position size in lots. */
  readonly lots: number;
  readonly targetPnl: number;
  readonly stopPnl: number;
  /** Margin required at the given leverage. */
  readonly margin: number;
}

/** Signed P&L of `qty` units from entry to exit. */
export const pnlOf = (side: Side, entry: number, exit: number, qty: number): number =>
  (side === 'long' ? exit - entry : entry - exit) * qty;

/**
 * Risk-based position sizing: quantity = risk / |entry − stop|, rounded down to the quantity
 * step and capped by account size × leverage.
 */
export function positionStats(l: PositionLevels, r: RiskParams): PositionStats {
  const targetDistance = Math.abs(l.target - l.entry);
  const stopDistance = Math.abs(l.entry - l.stop);
  const riskAmount = r.riskMode === 'percent' ? (r.accountSize * r.risk) / 100 : r.risk;
  const leverage = Math.max(1, r.leverage);
  let quantity = stopDistance > 0 ? riskAmount / stopDistance : 0;
  if (l.entry > 0) quantity = Math.min(quantity, (r.accountSize * leverage) / l.entry);
  quantity = floorToStep(Math.max(0, quantity), r.qtyStep);
  const ticks = (d: number) => Math.round(d / r.tickSize);
  const pct = (d: number) => (l.entry !== 0 ? (d / l.entry) * 100 : 0);
  return {
    targetDistance,
    targetTicks: ticks(targetDistance),
    targetPercent: pct(targetDistance),
    stopDistance,
    stopTicks: ticks(stopDistance),
    stopPercent: pct(stopDistance),
    riskReward: stopDistance > 0 ? targetDistance / stopDistance : 0,
    riskAmount,
    quantity,
    lots: r.lotSize > 0 ? quantity / r.lotSize : quantity,
    targetPnl: quantity * targetDistance,
    stopPnl: -quantity * stopDistance,
    margin: (quantity * l.entry) / leverage,
  };
}

export type PositionStatus = 'waiting' | 'open' | 'win' | 'loss' | 'closed';

export interface PositionOutcome {
  readonly status: PositionStatus;
  readonly entryIndex: number | null;
  readonly exitIndex: number | null;
  readonly exitPrice: number | null;
  /** Price the P&L is marked at (exit, or last close while open). */
  readonly markPrice: number | null;
  /** Realised (win/loss/closed) or open P&L per unit of quantity. */
  readonly pnlPerUnit: number;
}

export interface BarColumns {
  readonly length: number;
  readonly time: ArrayLike<number>;
  readonly high: ArrayLike<number>;
  readonly low: ArrayLike<number>;
  readonly close: ArrayLike<number>;
}

const WAITING: PositionOutcome = {
  status: 'waiting',
  entryIndex: null,
  exitIndex: null,
  exitPrice: null,
  markPrice: null,
  pnlPerUnit: 0,
};

/**
 * Walks the visible bars inside [startTime, endTime] (see ADR 0005):
 * entry fills at the first bar touching the entry price; a bar that touches both stop and
 * target counts as a LOSS (stop assumed first); on the entry bar only the stop is checked.
 * Only bars the caller provides are used, so replay never leaks future data.
 */
export function evaluatePosition(
  bars: BarColumns,
  l: PositionLevels,
  startTime: number,
  endTime: number,
): PositionOutcome {
  const n = bars.length;
  const times = bars.time as Float64Array;
  const start = firstGreaterOrEqual(times, n, startTime);
  const isLong = l.side === 'long';
  const hitStop = (i: number) => (isLong ? bars.low[i]! <= l.stop : bars.high[i]! >= l.stop);
  const hitTarget = (i: number) => (isLong ? bars.high[i]! >= l.target : bars.low[i]! <= l.target);
  const unit = (exit: number) => pnlOf(l.side, l.entry, exit, 1);

  let entryIndex: number | null = null;
  let last = -1;
  for (let i = start; i < n && bars.time[i]! <= endTime; i++) {
    last = i;
    if (entryIndex === null) {
      if (bars.low[i]! > l.entry || bars.high[i]! < l.entry) continue;
      entryIndex = i;
      if (hitStop(i)) return closedAt('loss', entryIndex, i, l.stop, unit);
      continue;
    }
    if (hitStop(i)) return closedAt('loss', entryIndex, i, l.stop, unit);
    if (hitTarget(i)) return closedAt('win', entryIndex, i, l.target, unit);
  }
  if (entryIndex === null || last < 0) return WAITING;
  const mark = bars.close[last]!;
  const windowOver = last + 1 < n && bars.time[last + 1]! > endTime;
  return {
    status: windowOver ? 'closed' : 'open',
    entryIndex,
    exitIndex: windowOver ? last : null,
    exitPrice: windowOver ? mark : null,
    markPrice: mark,
    pnlPerUnit: unit(mark),
  };
}

function closedAt(
  status: 'win' | 'loss',
  entryIndex: number,
  exitIndex: number,
  price: number,
  unit: (p: number) => number,
): PositionOutcome {
  return {
    status,
    entryIndex,
    exitIndex,
    exitPrice: price,
    markPrice: price,
    pnlPerUnit: unit(price),
  };
}
