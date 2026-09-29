'use client';

import {
  isConditionMet,
  type SettingsField,
  type SettingsGroup,
  type SettingsValues,
} from '@/lib/core';
import { FieldControl, type FieldChange } from './fields/FieldControl';

/** Groups consecutive `inline` fields onto the row of the preceding field. */
function rows(fields: readonly SettingsField[]): SettingsField[][] {
  const out: SettingsField[][] = [];
  for (const f of fields) {
    const last = out[out.length - 1];
    if (f.inline && last) last.push(f);
    else out.push([f]);
  }
  return out;
}

function Row({
  fields,
  values,
  onChange,
}: {
  fields: SettingsField[];
  values: SettingsValues;
  onChange: FieldChange;
}) {
  const [head, ...rest] = fields;
  if (!head) return null;
  const isBool = head.kind === 'boolean';
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 py-0.5">
      <label
        className={`flex w-44 shrink-0 items-center gap-2 text-[13px] ${isBool ? 'cursor-pointer' : 'text-muted'}`}
      >
        {isBool ? <FieldControl field={head} values={values} onChange={onChange} /> : null}
        <span className={isBool ? 'text-fg' : ''}>{head.label}</span>
      </label>
      {!isBool ? (
        <div className={head.kind === 'text' ? 'min-w-40 flex-1' : ''}>
          <FieldControl field={head} values={values} onChange={onChange} />
        </div>
      ) : null}
      {rest
        .filter((f) => isConditionMet(f.visibleWhen, values))
        .map((f) => (
          <span key={f.key} className="flex items-center gap-1.5" title={f.label}>
            {f.kind !== 'color' ? <span className="text-xs text-muted">{f.label}</span> : null}
            <FieldControl field={f} values={values} onChange={onChange} />
          </span>
        ))}
    </div>
  );
}

interface SchemaFormProps {
  readonly groups: readonly SettingsGroup[];
  readonly values: SettingsValues;
  readonly onChange: FieldChange;
}

/** Generic renderer for a tab's groups. No per-tool or per-setting UI code exists anywhere. */
export function SchemaForm({ groups, values, onChange }: SchemaFormProps) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {groups
        .filter((g) => isConditionMet(g.visibleWhen, values))
        .map((g) => (
          <section key={g.id} aria-label={g.label ?? g.id}>
            {g.label ? (
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {g.label}
              </h3>
            ) : null}
            {rows(g.fields)
              .filter((r) => isConditionMet(r[0]!.visibleWhen, values))
              .map((r) => (
                <Row key={r[0]!.key} fields={r} values={values} onChange={onChange} />
              ))}
          </section>
        ))}
    </div>
  );
}
