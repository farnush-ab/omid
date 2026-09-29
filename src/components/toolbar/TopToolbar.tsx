'use client';

import { chordLabel } from '@/lib/app';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Divider } from '../ui/Divider';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { TimeframeBar } from './TimeframeBar';
import { MoreMenu } from './MoreMenu';
import { ReplayButton } from './ReplayButton';

export function TopToolbar() {
  const app = useApp();
  const symbol = useUiStore((s) => s.symbol);
  const history = useUiStore((s) => s.history);
  const source = useUiStore((s) => s.source);
  const openDialog = useUiStore((s) => s.openDialog);
  return (
    <header className="flex h-10 shrink-0 items-center gap-0.5 border-b border-line bg-panel px-1.5">
      <Tooltip label="Symbol search" shortcut="Ctrl + K">
        <button
          type="button"
          onClick={() => openDialog({ type: 'symbol-search' })}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-fg hover:bg-hover"
        >
          <Icon name="search" size={16} />
          <span>{symbol?.symbol ?? '…'}</span>
        </button>
      </Tooltip>
      <Divider />
      <TimeframeBar />
      <Divider />
      <ReplayButton />
      <Divider />
      <IconButton
        icon="undo"
        label={history.undoLabel ? `Undo ${history.undoLabel}` : 'Undo'}
        shortcut={chordLabel('Ctrl+Z')}
        disabled={!history.canUndo}
        onClick={() => app.history.undo()}
      />
      <IconButton
        icon="redo"
        label={history.redoLabel ? `Redo ${history.redoLabel}` : 'Redo'}
        shortcut={chordLabel('Ctrl+Y')}
        disabled={!history.canRedo}
        onClick={() => app.history.redo()}
      />
      <div className="flex-1" />
      {source ? (
        <span
          className={`mr-1 hidden rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline ${
            source === 'synthetic' ? 'bg-[#f7a60026] text-[#f7a600]' : 'bg-[#08998126] text-up'
          }`}
          title={
            source === 'synthetic'
              ? 'Deterministic synthetic data (network unavailable)'
              : 'Binance REST data'
          }
        >
          {source === 'synthetic' ? 'SYNTHETIC' : 'BINANCE'}
        </span>
      ) : null}
      <span className="hidden sm:contents">
        <IconButton
          icon="palette"
          label="Themes"
          onClick={() => openDialog({ type: 'theme-editor' })}
        />
        <IconButton
          icon="keyboard"
          label="Keyboard shortcuts"
          shortcut="?"
          onClick={() => openDialog({ type: 'shortcuts' })}
        />
      </span>
      <IconButton
        icon="settings"
        label="Chart settings"
        shortcut="Ctrl + ,"
        onClick={() => openDialog({ type: 'settings' })}
      />
      <MoreMenu />
    </header>
  );
}
