# ADR 0001 — Custom Canvas 2D engine, no charting library

**Status:** accepted

## Context

The product needs TradingView-grade interaction (future space, axis dragging, replay, eight
drawing tools with schema-driven settings) and must hold 60 fps with 50k+ candles. Off-the-shelf
charting libraries either hide the render loop or bring their own drawing models that fight ours.

## Decision

Write a small engine on top of HTML5 Canvas 2D: layered canvases with dirty flags, a single
`requestAnimationFrame` loop, `Float64Array` OHLCV columns, viewport culling and pixel-column
decimation. The engine lives in `src/lib/core`, is framework-agnostic and is extended through
layers, interaction handlers and registries rather than edited.

## Consequences

- Full control of performance and behaviour; no dependency weight.
  − We own text layout, tick generation, hit-testing and DPR handling (covered by unit tests).
