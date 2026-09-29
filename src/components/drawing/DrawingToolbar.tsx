'use client';

import { useState } from 'react';
import { chordLabel } from '@/lib/app';
import type { CrosshairMode } from '@/lib/core';
import { drawingRegistry, type MagnetMode } from '@/lib/drawings';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Divider } from '../ui/Divider';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';

const CURSORS: ReadonlyArray<{ mode: CrosshairMode; label: string; icon: IconName }> = [
  { mode: 'full', label: 'Cross', icon: 'cross' },
  { mode: 'dot', label: 'Dot', icon: 'dot' },
  { mode: 'arrow', label: 'Arrow', icon: 'arrow' },
];

const MAGNETS: ReadonlyArray<{ mode: Exclude<MagnetMode, 'off'>; label: string }> = [
  { mode: 'weak', label: 'Weak magnet' },
  { mode: 'strong', label: 'Strong magnet' },
];

function Flyout({
  children,
  anchor,
  onClose,
}: {
  children: React.ReactNode;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="-m-2 flex min-w-40 flex-col">{children}</div>
    </Popover>
  );
}

function FlyoutItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: IconName;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover ${active ? 'text-accent' : ''}`}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {label}
    </button>
  );
}

/** Left vertical toolbar: cursor modes, every registered drawing tool, and drawing helpers. */
export function DrawingToolbar() {
  const app = useApp();
  const tool = useUiStore((s) => s.activeTool);
  const modes = useUiStore((s) => s.drawingModes);
  const crosshair = useUiStore((s) => s.options.crosshairMode);
  const history = useUiStore((s) => s.history);
  const count = useUiStore((s) => s.drawingCount);
  const pushToast = useUiStore((s) => s.pushToast);
  const [flyout, setFlyout] = useState<{ kind: 'cursor' | 'magnet'; el: HTMLElement } | null>(null);
  const [lastMagnet, setLastMagnet] = useState<Exclude<MagnetMode, 'off'>>('weak');
  const cursorIcon = CURSORS.find((c) => c.mode === crosshair)?.icon ?? 'cross';

  return (
    <nav
      aria-label="Drawing tools"
      className="flex w-12 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-line bg-panel py-1.5 [scrollbar-width:none]"
    >
      <div className="relative flex">
        <IconButton
          icon={cursorIcon}
          label="Cursor"
          shortcut="Esc"
          tooltipSide="right"
          active={tool === null}
          onClick={() => app.drawings.setTool(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setFlyout({ kind: 'cursor', el: e.currentTarget });
          }}
          className="h-9 w-9"
        />
        <button
          type="button"
          aria-label="Cursor options"
          onClick={(e) => setFlyout({ kind: 'cursor', el: e.currentTarget })}
          className="absolute -right-1 bottom-0 flex h-4 w-3 items-center justify-center text-muted hover:text-fg"
        >
          <Icon name="chevronRight" size={10} />
        </button>
      </div>
      <Divider vertical={false} />
      {drawingRegistry.list().map((def) => (
        <IconButton
          key={def.id}
          path={def.icon}
          label={def.label}
          shortcut={def.shortcut ? chordLabel(def.shortcut) : undefined}
          tooltipSide="right"
          active={tool === def.id}
          onClick={() => app.drawings.setTool(tool === def.id ? null : def.id)}
          className="h-9 w-9"
        />
      ))}
      <Divider vertical={false} />
      <div className="relative flex">
        <IconButton
          icon="magnet"
          label={modes.magnet === 'off' ? 'Magnet mode' : `Magnet: ${modes.magnet}`}
          shortcut={chordLabel('Alt+M')}
          tooltipSide="right"
          active={modes.magnet !== 'off'}
          onClick={() => app.drawings.setMagnet(modes.magnet === 'off' ? lastMagnet : 'off')}
          className="h-9 w-9"
        />
        <button
          type="button"
          aria-label="Magnet options"
          onClick={(e) => setFlyout({ kind: 'magnet', el: e.currentTarget })}
          className="absolute -right-1 bottom-0 flex h-4 w-3 items-center justify-center text-muted hover:text-fg"
        >
          <Icon name="chevronRight" size={10} />
        </button>
      </div>
      <IconButton
        icon="pencilLock"
        label="Stay in drawing mode"
        tooltipSide="right"
        active={modes.stayInDrawingMode}
        onClick={() => app.drawings.setModes({ stayInDrawingMode: !modes.stayInDrawingMode })}
        className="h-9 w-9"
      />
      <IconButton
        icon={modes.lockAll ? 'lock' : 'unlock'}
        label={modes.lockAll ? 'Unlock all drawings' : 'Lock all drawings'}
        shortcut={chordLabel('Ctrl+Alt+L')}
        tooltipSide="right"
        active={modes.lockAll}
        onClick={() => app.drawings.setModes({ lockAll: !modes.lockAll })}
        className="h-9 w-9"
      />
      <IconButton
        icon={modes.hideAll ? 'eyeOff' : 'eye'}
        label={modes.hideAll ? 'Show all drawings' : 'Hide all drawings'}
        shortcut={chordLabel('Ctrl+Alt+H')}
        tooltipSide="right"
        active={modes.hideAll}
        onClick={() => app.drawings.setModes({ hideAll: !modes.hideAll })}
        className="h-9 w-9"
      />
      <IconButton
        icon="trash"
        label="Remove all drawings"
        tooltipSide="right"
        disabled={count === 0}
        onClick={() => {
          app.drawings.removeAll();
          pushToast(`Removed ${count} drawing${count === 1 ? '' : 's'} — Ctrl+Z to undo`);
        }}
        className="h-9 w-9"
      />
      <Divider vertical={false} />
      <IconButton
        icon="undo"
        label="Undo"
        shortcut={chordLabel('Ctrl+Z')}
        tooltipSide="right"
        disabled={!history.canUndo}
        onClick={() => app.history.undo()}
        className="h-9 w-9"
      />
      <IconButton
        icon="redo"
        label="Redo"
        shortcut={chordLabel('Ctrl+Y')}
        tooltipSide="right"
        disabled={!history.canRedo}
        onClick={() => app.history.redo()}
        className="h-9 w-9"
      />

      {flyout?.kind === 'cursor' ? (
        <Flyout anchor={flyout.el} onClose={() => setFlyout(null)}>
          {CURSORS.map((c) => (
            <FlyoutItem
              key={c.mode}
              icon={c.icon}
              label={c.label}
              active={crosshair === c.mode}
              onClick={() => {
                app.settings.update({ crosshairMode: c.mode });
                app.drawings.setTool(null);
                setFlyout(null);
              }}
            />
          ))}
        </Flyout>
      ) : null}
      {flyout?.kind === 'magnet' ? (
        <Flyout anchor={flyout.el} onClose={() => setFlyout(null)}>
          {MAGNETS.map((m) => (
            <FlyoutItem
              key={m.mode}
              icon="magnet"
              label={m.label}
              active={modes.magnet === m.mode}
              onClick={() => {
                setLastMagnet(m.mode);
                app.drawings.setMagnet(m.mode);
                setFlyout(null);
              }}
            />
          ))}
          <FlyoutItem
            label="Off"
            active={modes.magnet === 'off'}
            onClick={() => (app.drawings.setMagnet('off'), setFlyout(null))}
          />
        </Flyout>
      ) : null}
    </nav>
  );
}
