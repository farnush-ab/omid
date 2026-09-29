import type { Theme } from '@/lib/core';
import type { AnyToolDefinition, DrawingStyle } from './types';

/**
 * Per-tool default styles: definition defaults, then theme bindings, then the user's saved
 * defaults ("Template → Save as default"). Persisted by the app layer.
 */
export class ToolDefaults {
  private overrides = new Map<string, DrawingStyle>();
  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  resolve(def: AnyToolDefinition, theme: Theme): DrawingStyle {
    const style: DrawingStyle = { ...def.defaults };
    for (const [key, colorKey] of Object.entries(def.themeDefaults ?? {})) {
      if (colorKey) style[key] = theme.colors[colorKey];
    }
    const user = this.overrides.get(def.id);
    if (user) for (const k of Object.keys(def.defaults)) if (k in user) style[k] = user[k];
    return style;
  }

  set(toolId: string, style: DrawingStyle): void {
    this.overrides.set(toolId, structuredClone(style));
    this.emit();
  }

  reset(toolId: string): void {
    if (this.overrides.delete(toolId)) this.emit();
  }

  has(toolId: string): boolean {
    return this.overrides.has(toolId);
  }

  snapshot(): Record<string, DrawingStyle> {
    return Object.fromEntries([...this.overrides].map(([k, v]) => [k, structuredClone(v)]));
  }

  load(data: Record<string, DrawingStyle>): void {
    this.overrides = new Map(Object.entries(data).map(([k, v]) => [k, structuredClone(v)]));
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
