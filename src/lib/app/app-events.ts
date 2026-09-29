import type { HistoryState, SymbolInfo, Theme, TimeframeId } from '@/lib/core';

/** UI actions the app asks the React layer to perform (dialogs are a UI concern). */
export type UiCommand =
  | { readonly type: 'open-symbol-search'; readonly initial?: string }
  | { readonly type: 'open-settings'; readonly tab?: string }
  | { readonly type: 'open-shortcuts' }
  | { readonly type: 'open-theme-editor' }
  | { readonly type: 'close-dialogs' };

/** Application -> UI events (engine events are available on app.engine.events). */
export interface AppEventMap {
  'market:changed': { readonly symbol: SymbolInfo; readonly timeframe: TimeframeId };
  'market:loading': { readonly loading: boolean; readonly kind: 'initial' | 'history' };
  'market:source': { readonly source: string };
  'market:error': { readonly message: string };
  'themes:changed': {
    readonly themes: readonly Theme[];
    readonly active: Theme;
    readonly previewing: boolean;
  };
  'history:changed': HistoryState;
  'interval-typer': { readonly text: string | null; readonly valid: boolean };
  'ui:command': UiCommand;
  toast: { readonly message: string; readonly kind: 'info' | 'error' };
}
