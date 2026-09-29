# Lessons (record & replay)

A lesson is a screen-free recording of the chart: the teacher talks while working on the chart,
and the lesson stores the voice plus the chart **state** over time. It stores no video. Students
play it back on a live, interactive chart, and they can pause at any moment to explore.

## How it works

```
src/lib/lessons      timeline model, keyframe index, recorder log, codec, repository (core only)
src/lib/app/lessons  chart slices, RecordingSession, LessonPlayer, browser audio adapters
src/components/lessons  library (start screen), recorder bar, player
```

**Timeline.** `initial` (a full state snapshot) followed by a sorted op log `{t, s, v}`. Here `t`
is lesson time in ms, `s` is a slice id and `v` is that slice's new value. Slices are
independent pieces of chart state:

| slice       | value                                         | notes                                       |
| ----------- | --------------------------------------------- | ------------------------------------------- |
| `stage`     | chart size in px                              | the player letterboxes to its aspect ratio  |
| `market`    | symbol + timeframe                            | recorded when the bars reach the chart      |
| `options`   | all `ChartOptions` (scale mode, grid, …)      |                                             |
| `theme`     | the full theme object                         | custom themes replay without being stored   |
| `drawings`  | serialized drawings                           | throttled while a drawing is dragged        |
| `modes`     | magnet / lock-all / hide-all / stay-in-mode   |                                             |
| `tool`      | active drawing tool                           |                                             |
| `selection` | selected drawing id                           |                                             |
| `placement` | the drawing being placed (serialized)         | the shape following the pointer; continuous |
| `view`      | right-edge **time**, bar spacing, price range | continuous (interpolated)                   |
| `cursor`    | pointer as a fraction of the chart size       | continuous (interpolated)                   |

**Seeking.** `TimelineIndex` builds in-memory keyframes every 2 s. `stateAt(t)` takes the
nearest keyframe and folds the few ops that follow it. Continuous slices are interpolated
between samples that are part of one motion; samples more than 250 ms apart are held instead.
Seeking is therefore O(ops in 2 s), in either direction.

**Clock and sync.** During recording, `RecordingClock` only advances while running, so paused
time does not exist in the lesson. During playback, the voice track is the clock: on every
frame the player reads `audio.currentTime` and applies the state at that time. Chart and voice
therefore cannot drift, at any speed, while buffering, after seeks, or at the end. Silent
lessons use `VirtualMedia` instead. MediaRecorder WebM files have no duration, so
`fixWebmDuration` writes one, and seeking works.

**Determinism.** A lesson embeds every bar the recording showed (`datasets`, one per symbol and
timeframe, captured by `CapturingProvider`). The player uses a separate `ChartApp` with a
`LessonDataProvider` and in-memory storage, so it never fetches live data, and the student's
session never touches saved drawings or preferences. Views are stored in chart coordinates,
so each screen shows the same candles.

**Isolation.** The timeline is never mutated. Pausing enters _free play_: the chart is fully
interactive, and a badge plus **Reset to lesson** appear. **Play**, **Seek** and **Reset**
re-apply the recorded state in full, which discards whatever the student changed.

**Storage.** `LessonRepository` is the port. `StorageLessonRepository` implements it on any
key/value `StorageAdapter`, and in the browser that is IndexedDB (database
`tradingchart-lessons`). The timeline is gzip-compressed JSON and the voice is a Blob. A backend
only needs another `LessonRepository`; the lesson format stays the same.

**Never losing work.** While recording, a draft is autosaved every 3 s: new op segments, new
1-second voice chunks and changed datasets. It is also autosaved when the tab is hidden or
closed. Unfinished recordings appear in the library under _Unfinished recordings_ with
**Recover** and **Discard**. If saving fails, the draft is kept. Microphone problems (denied,
missing, busy) offer _Record without voice_. A microphone that disconnects mid-lesson pauses
the recording.

**Size.** Voice is mono Opus at about 16–24 kbps, which is about 3.5–5 MB per 30 minutes. The
timeline, gzip-compressed, is typically well under 1 MB; bars dominate short lessons.

## Making a new feature recordable

Add a `ChartSlice` to `CHART_SLICES` in `src/lib/app/lessons/chart-slices.ts`:

```ts
const myFeature: ChartSlice<MyValue> = {
  id: 'myFeature',
  mode: 'record', // 'sample' for high-frequency values (throttled to ~25 Hz)
  capture: (app) => app.myFeature.snapshot(), // JSON-serializable, in chart coordinates
  watch: (app, changed) => app.myFeature.events.on('changed', changed),
  apply: (app, v) => v && app.myFeature.restore(v), // must fully set the state from v
};
```

Rules:

1. `capture` returns plain JSON. Use chart coordinates (time/price), never pixels, unless the
   value is about the screen itself (like the cursor).
2. `apply(value)` must produce the same state whatever the current state is. It is called on
   seeks in both directions and after a student's free play.
3. Order matters: put the slice after anything it depends on (the view comes after
   data and options).
4. If the value can change without an event, set `poll: true` (re-read every 100 ms).
5. For values that move smoothly, add `behavior: { continuous: true, interpolate }`.
6. Add the slice to the record → replay test (`tests/lessons/record-replay.test.ts`): change it
   during the recording and add a checkpoint.

Old lessons without the new slice keep working: a missing slice is `undefined` in the state, and
`apply` should treat that as "leave the default".

## Drawings as a process

Every step of making or editing a drawing is replayed, not only the result:

- **Placing:** picking the tool (`tool`), then the shape following the pointer between clicks
  or during a press-drag (`placement`, interpolated between samples). Freehand strokes grow
  point by point; paths add segments click by click. When a drawing is finished, it moves from
  `placement` to `drawings` at the same instant.
- **Cancelling:** Esc or right-click clears `placement`, so a cancelled drawing leaves nothing.
- **Editing:** moves, anchor drags, restyles, text typing and deletes all go through the
  drawing store and are captured by the `drawings` slice (throttled during drags; adds and
  removes are exact).
- **Seeking** into the middle of a gesture shows the half-drawn shape. The player renders it
  with `DrawingManager.showPlacementPreview`, like a live placement.

## Known limits

- Bar Replay during a recording is not captured as its own slice yet.
- Lessons are per browser; export/import of a lesson file is planned (phase 3).
