import type { Theme } from '../contracts/theme';
import type { ChartOptions } from '../model/chart-options';
import type { CrosshairState } from '../render/frame';

export interface ViewportInfo {
  readonly from: number;
  readonly to: number;
  readonly barSpacing: number;
  readonly rightIndex: number;
  /** True when the last bar is visible. */
  readonly atLatest: boolean;
}

export interface CrosshairInfo extends CrosshairState {
  /** Bar index clamped into the data range, or -1 when there is no data. */
  readonly barIndex: number;
}

export interface ContextMenuRequest {
  readonly x: number;
  readonly y: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly time: number;
  readonly price: number;
}

/** Engine -> UI events. */
export interface ChartEventMap {
  'viewport:changed': ViewportInfo;
  /** Viewport approached the oldest loaded bar; the app may prepend history. */
  'viewport:near-left-edge': { readonly firstTime: number };
  'crosshair:moved': CrosshairInfo | null;
  'data:changed': { readonly length: number; readonly reason: 'set' | 'prepend' | 'update' };
  'options:changed': Readonly<ChartOptions>;
  'theme:changed': Theme;
  contextmenu: ContextMenuRequest;
  resize: { readonly width: number; readonly height: number };
}
