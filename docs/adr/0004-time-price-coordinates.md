# ADR 0004 — Drawings are stored in (time, price), mapped through a fractional bar index

**Status:** accepted

## Decision

Drawing anchors are `{ time, price }`. Rendering maps time → fractional bar index (piecewise
linear between bars, extrapolated by the timeframe interval outside the data) → x, and price →
y through the active `PriceScale` (linear/log/percent, inverted or not). Moving a whole drawing
translates each anchor in index space so shapes keep their form across gaps.

## Consequences

- Drawings survive pan/zoom, scale-mode switches, timeframe switches, history prepends, replay.
  − A point between two bars on a higher timeframe maps inside a bar rather than at an exact
  boundary — the expected TradingView behaviour.
