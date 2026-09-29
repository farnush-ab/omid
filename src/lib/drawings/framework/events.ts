import type { MagnetMode } from './magnet';

export interface DrawingModes {
  readonly magnet: MagnetMode;
  readonly stayInDrawingMode: boolean;
  readonly lockAll: boolean;
  readonly hideAll: boolean;
}

/** Drawing subsystem -> UI events. */
export interface DrawingEventMap {
  /** Any change to the collection or a committed edit (drives persistence). */
  'drawings:changed': { readonly count: number };
  'selection:changed': { readonly id: string | null };
  /** Live or committed change of one drawing (floating toolbar / dialog refresh). */
  'drawing:updated': { readonly id: string };
  'tool:changed': { readonly tool: string | null };
  'modes:changed': DrawingModes;
  'text:edit': { readonly id: string };
  'settings:open': { readonly id: string };
  contextmenu: { readonly id: string; readonly clientX: number; readonly clientY: number };
}
