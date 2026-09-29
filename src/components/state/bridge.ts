import type { ChartApp } from '@/lib/app';
import { useUiStore } from './ui-store';

/**
 * The single subscription point between the app's event buses and the UI store.
 * Only low-frequency, panel-relevant state is mirrored; returns an unsubscribe function.
 */
export function connectBridge(app: ChartApp): () => void {
  const set = useUiStore.setState;
  const { openDialog, closeDialog, pushToast } = useUiStore.getState();
  set({
    options: app.engine.getOptions(),
    history: app.history.state,
    themes: app.themes.list(),
    activeTheme: app.themes.active,
  });
  const offs = [
    app.events.on('market:changed', ({ symbol, timeframe }) => set({ symbol, timeframe })),
    app.events.on('market:loading', ({ loading, kind }) =>
      set(kind === 'initial' ? { loading } : { historyLoading: loading }),
    ),
    app.events.on('market:source', ({ source }) => {
      if (source === 'synthetic' && useUiStore.getState().source !== 'synthetic') {
        pushToast('Live data unavailable — showing deterministic synthetic data.', 'info');
      }
      set({ source });
    }),
    app.events.on('market:error', ({ message }) =>
      pushToast(`Failed to load data: ${message}`, 'error'),
    ),
    app.events.on('themes:changed', ({ themes, active, previewing }) =>
      set({ themes, activeTheme: active, previewingTheme: previewing }),
    ),
    app.events.on('history:changed', (history) => set({ history })),
    app.events.on('interval-typer', ({ text, valid }) =>
      set({ intervalTyper: text === null ? null : { text, valid } }),
    ),
    app.events.on('toast', ({ message, kind }) => pushToast(message, kind)),
    app.events.on('ui:command', (cmd) => {
      switch (cmd.type) {
        case 'open-symbol-search':
          return openDialog(
            cmd.initial
              ? { type: 'symbol-search', initial: cmd.initial }
              : { type: 'symbol-search' },
          );
        case 'open-settings':
          return openDialog(cmd.tab ? { type: 'settings', tab: cmd.tab } : { type: 'settings' });
        case 'open-shortcuts':
          return openDialog({ type: 'shortcuts' });
        case 'open-theme-editor':
          return openDialog({ type: 'theme-editor' });
        case 'close-dialogs':
          return closeDialog();
      }
    }),
    app.engine.events.on('options:changed', (options) => set({ options: { ...options } })),
    app.engine.events.on('viewport:changed', ({ atLatest }) => {
      if (useUiStore.getState().atLatest !== atLatest) set({ atLatest });
    }),
  ];
  return () => offs.forEach((off) => off());
}
