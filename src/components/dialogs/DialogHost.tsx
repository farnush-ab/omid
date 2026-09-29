'use client';

import { useUiStore } from '../state/ui-store';
import { ChartSettingsDialog } from './ChartSettingsDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SymbolSearchDialog } from './SymbolSearchDialog';
import { ThemeEditorDialog } from './ThemeEditorDialog';

/** Renders the single open dialog, if any. */
export function DialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  const close = useUiStore((s) => s.closeDialog);
  if (!dialog) return null;
  switch (dialog.type) {
    case 'settings':
      return <ChartSettingsDialog initialTab={dialog.tab} onClose={close} />;
    case 'symbol-search':
      return <SymbolSearchDialog initial={dialog.initial} onClose={close} />;
    case 'shortcuts':
      return <ShortcutsDialog onClose={close} />;
    case 'theme-editor':
      return <ThemeEditorDialog onClose={close} />;
    default:
      return null;
  }
}
