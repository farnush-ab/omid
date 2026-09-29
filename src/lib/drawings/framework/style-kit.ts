import { z } from 'zod';
import { LINE_STYLES, type SettingsField } from '@/lib/core';

/** Reusable zod pieces for tool style schemas. */
export const zColor = z.string().min(1).max(64);
export const zOpacity = z.number().min(0).max(1);
export const zLineWidth = z.number().min(1).max(12);
export const zLineStyle = z.enum(LINE_STYLES);
export const zLineEnd = z.enum(['none', 'arrow', 'circle']);
export const zFontSize = z.number().min(6).max(96);
export const zFontFamily = z.string().min(1).max(120);
export const DEFAULT_FONT_FAMILY = 'Inter, system-ui, sans-serif';
export const zHAlign = z.enum(['left', 'center', 'right']);
export const zVAlign = z.enum(['top', 'middle', 'bottom']);

export const LINE_END_OPTIONS = [
  { value: 'none', label: 'Normal' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'circle', label: 'Circle' },
] as const;

export const H_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const;

export const V_ALIGN_OPTIONS = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
] as const;

/** Colour (with separate opacity key), width and style — the common "Line" row. */
export function lineFields(p: {
  color: string;
  opacity: string;
  width: string;
  style: string;
  label?: string;
}): SettingsField[] {
  return [
    { kind: 'color', key: p.color, label: p.label ?? 'Line', opacityKey: p.opacity },
    { kind: 'lineWidth', key: p.width, label: 'Width' },
    { kind: 'lineStyle', key: p.style, label: 'Style' },
  ];
}

/** Text content + font options. */
export function textFields(
  p: { withAlign?: string; withVAlign?: string; multiline?: boolean } = {},
): SettingsField[] {
  const f: SettingsField[] = [
    {
      kind: 'text',
      key: 'text',
      label: 'Text',
      multiline: p.multiline ?? true,
      placeholder: 'Add text',
    },
    { kind: 'color', key: 'textColor', label: 'Color' },
    { kind: 'fontSize', key: 'fontSize', label: 'Size', inline: true },
    { kind: 'fontFamily', key: 'fontFamily', label: 'Font' },
    { kind: 'boolean', key: 'bold', label: 'Bold' },
    { kind: 'boolean', key: 'italic', label: 'Italic' },
  ];
  if (p.withAlign)
    f.push({ kind: 'select', key: p.withAlign, label: 'Alignment', options: H_ALIGN_OPTIONS });
  if (p.withVAlign)
    f.push({
      kind: 'select',
      key: p.withVAlign,
      label: 'Vertical',
      options: V_ALIGN_OPTIONS,
      inline: true,
    });
  return f;
}
