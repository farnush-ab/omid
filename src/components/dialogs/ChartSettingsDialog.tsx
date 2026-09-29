'use client';

import { useMemo, useState } from 'react';
import { CHART_SETTINGS_SCHEMA } from '@/lib/app';
import { DEFAULT_CHART_OPTIONS, type ChartOptions, type ThemeColorKey } from '@/lib/core';
import { SchemaForm } from '../schema-form/SchemaForm';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Tabs } from '../ui/Tabs';

/** Chart settings, rendered entirely from CHART_SETTINGS_SCHEMA. Changes apply live and are undoable. */
export function ChartSettingsDialog({
  initialTab,
  onClose,
}: {
  readonly initialTab?: string | undefined;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const options = useUiStore((s) => s.options);
  const theme = useUiStore((s) => s.activeTheme);
  const themes = useUiStore((s) => s.themes);
  const openDialog = useUiStore((s) => s.openDialog);
  const tabs = CHART_SETTINGS_SCHEMA.tabs;
  const [tab, setTab] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0]!.id,
  );

  const values = useMemo(() => {
    const v: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(options)) v[`opt.${k}`] = val;
    for (const [k, val] of Object.entries(theme.colors)) v[`theme.${k}`] = val;
    return v;
  }, [options, theme]);

  const onChange = (key: string, value: unknown) => {
    if (key.startsWith('opt.'))
      app.settings.update({ [key.slice(4)]: value } as Partial<ChartOptions>, true);
    else if (key.startsWith('theme.'))
      app.themes.setActiveColor(key.slice(6) as ThemeColorKey, String(value));
  };

  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  return (
    <Dialog
      title="Chart settings"
      onClose={onClose}
      width={720}
      footer={
        <>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Theme
            <select
              className="h-8 rounded-md border border-line bg-panel px-2 text-fg"
              value={theme.id}
              onChange={(e) => app.themes.setActive(e.target.value)}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="ghost" onClick={() => openDialog({ type: 'theme-editor' })}>
            Edit themes…
          </Button>
          <div className="flex-1" />
          <Button onClick={() => app.settings.update(DEFAULT_CHART_OPTIONS)}>Reset defaults</Button>
          <Button variant="primary" onClick={onClose}>
            Ok
          </Button>
        </>
      }
    >
      <div className="flex min-h-[420px]">
        <Tabs vertical tabs={tabs} active={current.id} onChange={setTab} />
        <div role="tabpanel" className="min-w-0 flex-1">
          <SchemaForm groups={current.groups} values={values} onChange={onChange} />
        </div>
      </div>
    </Dialog>
  );
}
