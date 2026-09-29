import { create } from 'zustand';
import {
  DEFAULT_CHART_OPTIONS,
  type ChartOptions,
  type HistoryState,
  type SymbolInfo,
  type Theme,
  type TimeframeId,
} from '@/lib/core';
import type { DrawingModes, SerializedDrawing } from '@/lib/drawings';
import { darkTheme } from '@/lib/themes';

export type DialogState =
  | { readonly type: 'symbol-search'; readonly initial?: string }
  | { readonly type: 'settings'; readonly tab?: string }
  | { readonly type: 'shortcuts' }
  | { readonly type: 'theme-editor' }
  | { readonly type: 'drawing-settings'; readonly drawingId: string; readonly tab?: string }
  | { readonly type: 'replay-date' };

export type ContextMenuState = {
  readonly clientX: number;
  readonly clientY: number;
  readonly target:
    | { readonly kind: 'drawing'; readonly id: string }
    | { readonly kind: 'chart'; readonly time: number; readonly price: number };
};

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly kind: 'info' | 'error';
}

/**
 * UI-only state (zustand). Mirrors a small, slow-changing snapshot of engine/app state for
 * panels and toolbars; candles, viewport and drawings never live here.
 */
export interface UiState {
  symbol: SymbolInfo | null;
  timeframe: TimeframeId;
  loading: boolean;
  historyLoading: boolean;
  source: string;
  options: ChartOptions;
  themes: readonly Theme[];
  activeTheme: Theme;
  previewingTheme: boolean;
  history: HistoryState;
  atLatest: boolean;
  dialog: DialogState | null;
  intervalTyper: { text: string; valid: boolean } | null;
  toasts: readonly Toast[];
  activeTool: string | null;
  drawingModes: DrawingModes;
  /** Snapshot of the selected drawing (refreshed on every change of it). */
  selection: SerializedDrawing | null;
  drawingCount: number;
  contextMenu: ContextMenuState | null;
  textEdit: string | null;
}

interface UiActions {
  openDialog(dialog: DialogState): void;
  closeDialog(): void;
  pushToast(message: string, kind?: Toast['kind']): void;
  dismissToast(id: number): void;
  openContextMenu(menu: ContextMenuState | null): void;
  setTextEdit(id: string | null): void;
}

let toastSeq = 0;

export const useUiStore = create<UiState & UiActions>()((set) => ({
  symbol: null,
  timeframe: '1h',
  loading: true,
  historyLoading: false,
  source: '',
  options: DEFAULT_CHART_OPTIONS,
  themes: [],
  activeTheme: darkTheme,
  previewingTheme: false,
  history: { canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, revision: 0 },
  atLatest: true,
  dialog: null,
  intervalTyper: null,
  toasts: [],
  activeTool: null,
  drawingModes: { magnet: 'off', stayInDrawingMode: false, lockAll: false, hideAll: false },
  selection: null,
  drawingCount: 0,
  contextMenu: null,
  textEdit: null,
  openContextMenu: (contextMenu) => set({ contextMenu }),
  setTextEdit: (textEdit) => set({ textEdit }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  pushToast: (message, kind = 'info') =>
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id: ++toastSeq, message, kind }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
