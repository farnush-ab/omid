# TradingChart

A TradingView-style candlestick charting app built on a **custom HTML5 Canvas 2D engine** (no
charting libraries). Next.js (App Router) + TypeScript (strict) + Tailwind CSS, with zustand used
only for UI state.

- Candlesticks with a volume pane, linear / log / percent / inverted / locked price scales,
  TradingView-style pan, zoom, axis dragging, future space, and full / dot / arrow crosshairs.
- Binance REST data through a caching proxy route, with a deterministic synthetic fallback.
  Older history loads lazily; there are 11 timeframes, and you can switch by typing one.
- Eight drawing tools: Trend Line, Rectangle, Path, Curve, Text, Highlighter, Long Position and
  Short Position. Drawings support magnet snapping, undo/redo, copy/paste, per-symbol
  persistence, JSON import/export and schema-driven settings dialogs.
- Bar Replay with partial higher-timeframe candles, 0.1×–10× speeds, and live position P&L.
- Light and dark themes plus a full theme editor with live preview, import and export.
- Layered canvases with dirty flags, viewport culling and level-of-detail decimation. With 50k
  candles on screen, a frame costs about 5 ms of JS.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run test       # Vitest unit + contract tests
npm run lint       # ESLint (incl. architecture boundaries), zero warnings allowed
npm run typecheck  # tsc --noEmit
npm run check      # typecheck + lint + test
```

These URL options help with testing:

| Query                 | Effect                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| `?provider=synthetic` | Uses the offline deterministic data provider                           |
| `?bars=50000`         | Size of the initial load (stress test; best with `provider=synthetic`) |

`BINANCE_BASE_URL` (server env) overrides the upstream host, e.g. `https://api.binance.us`.
By default the proxy tries `data-api.binance.vision` and then `api.binance.com`. If both are
unreachable, it answers with synthetic bars and the toolbar shows a **SYNTHETIC** badge.

## Architecture overview

```
src/lib/core      engine, scales, viewport, renderers, layers, events, commands (pure TS)
src/lib/series    chart types (Candlestick)              ┐
src/lib/drawings  drawing framework + 8 tools            │ domain: depend on core only
src/lib/replay    replay FSM, session, controller        │
src/lib/themes    built-in themes, validation            ┘
src/lib/data      Binance / synthetic / fallback providers   ┐ infrastructure behind
src/lib/storage   IndexedDB / localStorage / memory, migrations ┘ DataProvider / StorageAdapter
src/lib/app       composition root, services, shortcuts
src/components    thin React UI (toolbars, dialogs, schema-driven forms)
src/app           Next.js layout, page, /api/klines route
```

Dependencies only point inward, and a local ESLint rule enforces that. The engine owns all
chart state. React only subscribes to low-frequency snapshots through a single event bridge,
and the legend writes to the DOM directly, so hovering never re-renders React. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), the [ADRs](docs/adr/README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md), which covers adding a tool, chart type, provider or theme.

## Keyboard shortcuts

The same list is available in the app (press `?`). It is generated from the central shortcut
registry, and each tool's shortcut comes from its definition.

| Action                                | Keys                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| Undo / Redo                           | `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z`                           |
| Symbol search                         | `Ctrl+K`, or just type letters                                |
| Change interval                       | type e.g. `5`, `4h`, `1D`, `W` then `Enter`                   |
| Chart settings                        | `Ctrl+,`                                                      |
| Keyboard shortcuts                    | `?`                                                           |
| Reset chart view                      | `Alt+R`                                                       |
| Jump to latest bar                    | `End`                                                         |
| Auto / Log / Percent / Invert scale   | `Alt+A` / `Alt+L` / `Alt+P` / `Alt+I`                         |
| Toggle volume pane                    | `Alt+V`                                                       |
| Scroll / Zoom                         | `←` `→` / `Ctrl+↑` `Ctrl+↓`                                   |
| Trend Line · Rectangle · Path · Curve | `Alt+T` · `Alt+Shift+R` · `Alt+Shift+P` · `Alt+Shift+C`       |
| Text · Highlighter · Long · Short     | `Alt+Shift+T` · `Alt+Shift+H` · `Alt+Shift+L` · `Alt+Shift+S` |
| Cancel tool / finish path / deselect  | `Esc`                                                         |
| Finish path                           | `Enter` (or double-click)                                     |
| Delete selected drawing               | `Delete`, `Backspace`                                         |
| Copy / Paste / Duplicate drawing      | `Ctrl+C` / `Ctrl+V` / `Ctrl+D`                                |
| Nudge selected drawing                | arrows (`Shift` = ×10)                                        |
| Magnet off → weak → strong            | `Alt+M` (hold `Ctrl` while drawing to toggle)                 |
| Hide / Lock all drawings              | `Ctrl+Alt+H` / `Ctrl+Alt+L`                                   |
| Replay: step forward / play-pause     | `Shift+→` / `Space`                                           |
| Replay: cancel start selection        | `Esc`                                                         |

On macOS, `Ctrl` shortcuts also work with `Cmd`.

## Mouse and touch

- **Pan**: drag the chart. Vertical panning works when auto-scale is off.
- **Zoom**: use the wheel (anchored at the cursor) or pinch.
- **Axes**: drag the price axis to scale vertically and the time axis to zoom horizontally.
  Double-click either axis to reset it.
- **Touch**: long-press to show the crosshair.
- **Drawings**:
  - Click to select a drawing, and drag its handles or body to change it.
  - Double-click a drawing to open its settings, or to edit a Text drawing.
  - On a Path, double-click a segment to insert a point, and double-click a point to delete it.
  - Right-click a drawing for its context menu.

## Data notes

- Times display in the browser's local timezone. Daily and longer bars are labelled by their
  UTC date, as Binance defines them.
- Symbol metadata (tick size, precision, quantity step) comes from a small built-in catalogue.
  Unknown symbols default to 2 decimals.
