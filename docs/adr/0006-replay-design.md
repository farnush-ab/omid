# ADR 0006 — Replay as an explicit state machine over a time cursor

**Status:** accepted

## Decision

`replay-machine.ts` is a pure transition function (`idle → selecting → paused ↔ playing →
exited`). `ReplaySession` holds the full data out of the engine's reach and exposes only the
revealed `SeriesData`. The cursor is a **time**, not an index, so timeframe changes keep replay
time consistent; a finer `baseTimeframe` lets higher-timeframe candles form progressively
(partial candles). Ticks come from an injected `Timer`, so tests step deterministically.
Speeds are bars per second: `interval = 1000 / speed` ms.

## Consequences

- Future data cannot leak into auto-scale, crosshair, legend or position-tool evaluation.
  − Switching to a much higher timeframe requires fetching base-resolution data for the current
  bucket (one small request).
