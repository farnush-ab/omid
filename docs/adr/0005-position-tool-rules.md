# ADR 0005 — Long/Short position evaluation rules

**Status:** accepted

## Decision

A position is evaluated only on bars the engine can see (so replay never leaks), within the
tool's time window `[startTime, endTime]`:

1. **Entry**: the first bar at/after `startTime` whose `[low, high]` contains the entry price.
   Until then status is `waiting`.
2. **Exit**: from the entry bar on, a bar that reaches the stop loss closes the trade as `loss`;
   otherwise a bar that reaches the take profit closes it as `win`.
3. **Both touched in one bar → stop loss first** (conservative; intrabar order is unknown).
   On the entry bar itself only the stop is checked, because the target could have been touched
   before the fill.
4. If the window ends without an exit, the trade is `closed` at the last bar's close
   (`timeout`); while bars are still arriving inside the window it is `open` with live P&L
   marked at the last close.

P&L = `qty × (exit − entry)` for longs, mirrored for shorts. Quantity comes from risk sizing
(`risk / |entry − stop|`) or the fixed quantity, rounded down to the symbol's quantity step.
Ticks use the symbol's tick size.
