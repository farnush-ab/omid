import type { Migration } from './types';

/** v1 (pre-release) stored anchors as [time, price] tuples, "tool" and "visible". */
interface DrawingV1 {
  id: string;
  tool: string;
  pts: Array<[number, number]>;
  style?: Record<string, unknown>;
  locked?: boolean;
  visible?: boolean;
}

interface DrawingV2 {
  id: string;
  type: string;
  points: Array<{ time: number; price: number }>;
  style: Record<string, unknown>;
  locked: boolean;
  hidden: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export const drawingsV1ToV2: Migration = {
  kind: 'drawings',
  from: 1,
  to: 2,
  description: 'Tuple anchors -> {time, price}; tool -> type; visible -> hidden',
  migrate(data) {
    if (!isObject(data) || !Array.isArray(data.drawings)) return data;
    const drawings: DrawingV2[] = (data.drawings as DrawingV1[]).map((d) => ({
      id: d.id,
      type: d.tool,
      points: (d.pts ?? []).map(([time, price]) => ({ time, price })),
      style: d.style ?? {},
      locked: d.locked ?? false,
      hidden: d.visible === false,
    }));
    return { ...data, drawings };
  },
};
