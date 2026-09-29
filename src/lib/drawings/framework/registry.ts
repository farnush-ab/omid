import { Registry, validateSchema } from '@/lib/core';
import type { AnyToolDefinition } from './types';

/** Registry of drawing tools. Registration validates the settings schema against defaults. */
export class DrawingRegistry extends Registry<AnyToolDefinition> {
  constructor() {
    super('DrawingRegistry');
  }

  override register(def: AnyToolDefinition): this {
    const errors = validateSchema(def.settings, def.defaults);
    for (const key of def.toolbar)
      if (!(key in def.defaults)) errors.push(`toolbar key "${key}" has no default`);
    if (errors.length)
      throw new Error(`Drawing tool "${def.id}" has an invalid schema: ${errors.join('; ')}`);
    return super.register(def);
  }
}

export const drawingRegistry = new DrawingRegistry();
