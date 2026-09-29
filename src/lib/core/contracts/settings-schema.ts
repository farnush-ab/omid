/**
 * Declarative settings schema. Drawings, the chart settings dialog and the floating toolbar are
 * all rendered from these descriptions by a generic form renderer — never by hand-written UI.
 */
export type SettingsValue = string | number | boolean;
export type SettingsValues = Readonly<Record<string, unknown>>;

export interface FieldCondition {
  readonly key: string;
  /** Visible when values[key] === equals. */
  readonly equals?: SettingsValue;
  /** Visible when values[key] !== notEquals. */
  readonly notEquals?: SettingsValue;
  /** Visible when Boolean(values[key]) === truthy. */
  readonly truthy?: boolean;
}

interface FieldBase {
  readonly key: string;
  readonly label: string;
  readonly visibleWhen?: FieldCondition;
  /** Render on the same row as the previous field. */
  readonly inline?: boolean;
}

export interface SelectOption {
  readonly value: string | number;
  readonly label: string;
}

export type SettingsField =
  | (FieldBase & { readonly kind: 'boolean' })
  | (FieldBase & { readonly kind: 'color'; readonly opacityKey?: string })
  | (FieldBase & {
      readonly kind: 'number';
      readonly min?: number;
      readonly max?: number;
      readonly step?: number;
      readonly unit?: string;
    })
  | (FieldBase & { readonly kind: 'select'; readonly options: readonly SelectOption[] })
  | (FieldBase & { readonly kind: 'lineWidth' })
  | (FieldBase & { readonly kind: 'lineStyle' })
  | (FieldBase & { readonly kind: 'opacity' })
  | (FieldBase & { readonly kind: 'fontSize' })
  | (FieldBase & { readonly kind: 'fontFamily' })
  | (FieldBase & {
      readonly kind: 'text';
      readonly multiline?: boolean;
      readonly placeholder?: string;
    });

export type SettingsFieldKind = SettingsField['kind'];

export interface SettingsGroup {
  readonly id: string;
  readonly label?: string;
  readonly fields: readonly SettingsField[];
  readonly visibleWhen?: FieldCondition;
}

export interface SettingsTab {
  readonly id: string;
  readonly label: string;
  readonly groups: readonly SettingsGroup[];
}

export interface SettingsSchema {
  readonly tabs: readonly SettingsTab[];
}

export const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

export const FONT_SIZES = [10, 11, 12, 14, 16, 20, 24, 28, 32, 40] as const;
export const FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Menlo, Consolas, monospace',
  'Verdana, sans-serif',
] as const;

export function isConditionMet(cond: FieldCondition | undefined, values: SettingsValues): boolean {
  if (!cond) return true;
  const v = values[cond.key];
  if (cond.equals !== undefined && v !== cond.equals) return false;
  if (cond.notEquals !== undefined && v === cond.notEquals) return false;
  if (cond.truthy !== undefined && Boolean(v) !== cond.truthy) return false;
  return true;
}

export function schemaFields(schema: SettingsSchema): SettingsField[] {
  return schema.tabs.flatMap((t) => t.groups.flatMap((g) => [...g.fields]));
}

/** Structural validation used by contract tests and at registration time. */
export function validateSchema(schema: SettingsSchema, values: SettingsValues): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const field of schemaFields(schema)) {
    if (keys.has(field.key)) errors.push(`duplicate field key "${field.key}"`);
    keys.add(field.key);
    if (!(field.key in values)) errors.push(`field "${field.key}" has no default value`);
    if (field.kind === 'color' && field.opacityKey && !(field.opacityKey in values)) {
      errors.push(`opacityKey "${field.opacityKey}" of "${field.key}" has no default value`);
    }
    if (field.kind === 'select' && field.options.length === 0) {
      errors.push(`select "${field.key}" has no options`);
    }
  }
  const allConds = schema.tabs.flatMap((t) =>
    t.groups.flatMap((g) => [g.visibleWhen, ...g.fields.map((f) => f.visibleWhen)]),
  );
  for (const c of allConds) {
    if (c && !(c.key in values)) errors.push(`condition references unknown key "${c.key}"`);
  }
  return errors;
}
