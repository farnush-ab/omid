# ADR 0003 — Command pattern with snapshot-based drawing updates

**Status:** accepted

## Decision

All mutations go through `CommandHistory.execute(command)`. Drawing edits use a generic
`UpdateDrawingCommand(before, after)` built from serialized snapshots instead of one bespoke
command per property. Continuous gestures (dragging, typing) mutate a live object and commit a
single command when the gesture ends; consecutive style edits from the same control may `merge`.

## Consequences

- Any new drawing or setting is undoable for free; persistence subscribes to history changes.
- Snapshots are the same format as persistence, so they are validated by the same code.
  − Snapshots cost a little memory per step (bounded history, default 200 entries).
