# Contributing

## Workflow

1. `npm install`, then `npm run dev`.
2. Keep changes inside the layer they belong to. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
   has the dependency matrix, and `npm run lint` enforces it.
3. Before committing, run `npm run check` (typecheck, zero-warning lint, tests) and
   `npm run format`.
4. Record significant decisions as a short ADR in `docs/adr/`.

## House rules

- **No magic numbers.** Engine constants live in `src/lib/core/config.ts`, app constants in
  `src/lib/app/config.ts`, and UI tokens in `src/components/ui/tokens.ts` and `globals.css`.
- **Determinism.** Code in `core`, `series`, `drawings` and `replay` must not call `Date.now()`,
  `new Date()`, `Math.random()` or `performance.now()`; lint rejects them. Use the injected
  `Clock`, `Rng` and `Timer` instead.
- **Mutations are Commands.** Anything the user can change goes through `CommandHistory`,
  which gives undo/redo and triggers autosave.
- **No chart state in React.** Components read snapshots from `useUiStore` (fed by
  `components/state/bridge.ts`) and call methods on `ChartApp`.
- **Small files.** The soft limit is about 300 lines; split by responsibility.
- **Barrels at module boundaries only.** UI code imports `@/lib/<module>`, never deep paths.
- **Everything persisted is versioned.** New data goes into an `Envelope` and has a migration
  path (see below).

## How to add a new drawing tool

This needs one new folder and one line of registration. Nothing in the engine, the UI or the
settings dialog changes.

1. Copy the template:
   `cp -r src/lib/drawings/tools/_template src/lib/drawings/tools/my-tool`
2. In `my-tool/index.ts`:
   - Define the **style** with zod (`styleSchema`). The TypeScript type is inferred from it.
   - Implement the drawing by extending `BaseDrawing<Style>` and adding `renderShape()` and
     `hitBody()`. Override `getAnchors()` / `moveAnchor()` for custom handles (see Rectangle
     and Position), `bounds()` for extended shapes, and `textKey` / `textRect()` for inline
     text editing (see Text).
   - Describe the tool in a `DrawingToolDefinition`:
     - `id`, `label`, `icon` (24×24 SVG path), and an optional unique `shortcut`.
     - `placement`: one of `points` (with `count`), `polyline`, `freehand` or `single`.
       Use `finalizePoints` to derive extra points (Curve handle, Position levels).
     - `defaults` and `themeDefaults` (style keys that follow the theme's drawing colours).
     - `settings`: the declarative Style tab(s). Use the field kinds from
       `core/contracts/settings-schema.ts` and the helpers in `framework/style-kit.ts`. The
       Coordinates tab is generated automatically; tune it with `pointLabels`,
       `coordinateFields` and `normalizePoints`.
     - `toolbar`: the style keys shown in the floating toolbar.
     - `derivedFields` (optional): computed settings such as "target in ticks".
3. Register it in `src/lib/drawings/register.ts`:
   ```ts
   .register(myTool)
   ```
4. Run `npm test`. The shared contract suite (`tests/drawings/contract.test.ts`) automatically
   checks serialisation round-trips, style validation, anchors, hit-testing, rendering and
   schema validity for every registered tool. Add tool-specific tests next to
   `tests/drawings/tools.test.ts`.

You get the toolbar button, tooltip, shortcut, shortcuts-dialog entry, placement workflow,
selection and handles, settings dialog, floating toolbar, context menu, undo/redo, copy/paste,
per-symbol persistence and import/export for free.

## How to add a new chart (series) type

1. Create `src/lib/series/<type>/index.ts` exporting a `SeriesDefinition`
   (`core/contracts/series.ts`). `create(ctx)` returns a `Series`, which is a `LayerRenderer`
   plus `priceRange(from, to)` for auto-scale. Use `ctx.minMax()` for O(n/64) extents, and
   draw in device pixels with viewport culling as `candlestick-renderer.ts` does.
2. Register it in `src/lib/series/register.ts`.
3. The composition root currently picks `DEFAULT_SERIES_ID`. A chart-type picker would read
   `seriesRegistry.list()` without any engine change.

## How to add a new data provider

1. Implement `DataProvider` (`core/contracts/data-provider.ts`) in `src/lib/data/<name>/`:
   - `fetchBars({ symbol, timeframe, startTime?, endTime?, limit })` returns ascending
     `Candle[]`, `source` and `hasMoreHistory`.
   - `searchSymbols` and `getSymbolInfo` (tick size, precision, quantity step).
2. Register a `DataProviderDefinition` in `src/lib/data/register.ts`.
3. Select it in the composition root (`src/lib/app/composition.ts`) or with `?provider=<id>`.
   Wrap it in `FallbackProvider` if it should degrade to synthetic data.
4. Add tests in `tests/data/`. Paging must line up exactly (see the synthetic paging test).

## How to add a new theme

- **Built-in theme:** add `src/lib/themes/builtin/<name>.ts` exporting a `Theme` with every key
  in `ThemeColors`, then register it in `src/lib/themes/register.ts`. The tests assert that
  built-ins define every colour.
- **New colour key:** add it to `ThemeColors` and `THEME_COLOR_KEYS` (core), give it a value in
  each built-in theme, and add it to `THEME_COLOR_GROUPS` so the editor shows it (the tests check
  coverage). `parseTheme` fills the new key in older saved themes from the built-in, so no
  migration is needed.
- Users can also create themes in the app (Themes dialog) and import/export them as JSON.

## How to change a persisted format (migrations)

1. Bump `CURRENT_VERSION[kind]` in `src/lib/storage/envelope.ts`.
2. Add `src/lib/storage/migrations/<kind>-v<N>-to-v<N+1>.ts`. It must be a pure function over
   **locally declared historical types**; never import current domain types.
3. Append it to `MIGRATIONS` in `src/lib/storage/migrations/index.ts`.
4. Add a test like `tests/storage/storage.test.ts`. `validateMigrationChains()` fails the
   build if a step is missing.

## How to add a keyboard shortcut

Add a `ShortcutDefinition` to `src/lib/app/shortcuts/default-shortcuts.ts` (or to the drawing
or replay shortcut files). Registration order is match priority, and `when` scopes it. The
shortcuts dialog picks it up automatically.
