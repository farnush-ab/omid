# ADR 0007 — Versioned envelopes, migrations and validation for all persisted data

**Status:** accepted

## Decision

Everything persisted or exported is wrapped as `{ kind, schemaVersion, data }`. On load:
`migrate()` applies ordered, pure `Migration` steps from `storage/migrations/` up to the current
version, then zod validates, then registries rebuild objects. Imports go through the same path.
Migrations describe historical shapes with local types and never import current domain types.

## Consequences

- Old saves and exported files keep loading after format changes.
- Corrupt/unknown data is rejected or skipped instead of crashing the chart.
