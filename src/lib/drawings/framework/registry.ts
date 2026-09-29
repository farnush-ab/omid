import { Registry, validateSchema } from '@/lib/core';
import type { AnyToolDefinition } from './types';

/** Values the settings schema is validated against: style defaults plus derived keys. */
export function definitionSchemaValues(def: AnyToolDefinition): Record<string, unknown> {
  const values: Record<string, unknown> = { ...def.defaults };
  for (const k of def.derivedFields?.keys ?? []) values[k] = 0;
  return values;
}

/** Registry of drawing tools. Registration validates the settings schema against defaults. */
export class DrawingRegistry extends Registry<AnyToolDefinition> {
  constructor() {
    super('DrawingRegistry');
  }

  override register(def: AnyToolDefinition): this {
    const errors = validateSchema(def.settings, definitionSchemaValues(def));
    for (const key of def.toolbar)
      if (!(key in def.defaults)) errors.push(`toolbar key "${key}" has no default`);
    if (errors.length)
      throw new Error(`Drawing tool "${def.id}" has an invalid schema: ${errors.join('; ')}`);
    return super.register(def);
  }
}

export const drawingRegistry = new DrawingRegistry();
