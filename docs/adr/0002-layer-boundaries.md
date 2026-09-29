# ADR 0002 — Inward-only layering enforced by a local ESLint rule

**Status:** accepted

## Context

The layering (core ← domain ← infrastructure ← app ← UI) only holds if it is enforced.
`eslint-plugin-boundaries` was evaluated but its current release pulls a vulnerable `handlebars`.

## Decision

A ~100 line local rule (`eslint-rules/layer-boundaries.mjs`) classifies every file and import
into an element and checks an explicit allow-matrix, bans framework packages inside `src/lib`,
and forces UI code to use module barrels. Determinism is enforced with
`no-restricted-properties` (`Date.now`, `Math.random`, `performance.now`).

## Consequences

- No dependency, readable matrix, same rule for aliases and relative paths.
  − The matrix must be updated when a new top-level module is created (documented in CONTRIBUTING).
