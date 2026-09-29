# ADR 0008 — Performance budget and where the time goes

**Status:** accepted

## Context

The target is 60 fps with 50k+ candles. Profiling the first implementation at 50k fully
visible bars found three costs: rebuilding the frame state (auto-scale and tick selection) on
crosshair-only frames, time-tick selection that scanned every visible bar, and one `fillRect`
per decimated column.

## Decision

- Crosshair-only frames reuse the previous frame state (0.01 ms).
- Time ticks use per-weight index lists with an early exit once no gap can fit another label
  (2.5 ms → 0.04 ms).
- Decimated columns and wicks are batched into one path per colour.
- Volume decimation is single-pass (max volume per column, coloured by net direction).

## Consequences

At 50k bars a full redraw costs ~4.7 ms of JS (budget 16.7 ms). The remaining cost is raster,
which scales with canvas area × DPR rather than bar count. No Web Worker is needed for the
current feature set (see ARCHITECTURE §5).
