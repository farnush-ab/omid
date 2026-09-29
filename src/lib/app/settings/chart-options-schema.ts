import { z } from 'zod';
import { DEFAULT_CHART_OPTIONS, ENGINE_CONFIG, LINE_STYLES, type ChartOptions } from '@/lib/core';

const { volume } = ENGINE_CONFIG;

/** Validation for persisted chart options. Unknown keys are dropped, missing ones defaulted. */
export const chartOptionsSchema = z
  .object({
    showBody: z.boolean(),
    showBorders: z.boolean(),
    showWicks: z.boolean(),
    pricePrecision: z.number().int().min(-1).max(10),
    showStatusSymbol: z.boolean(),
    showStatusOHLC: z.boolean(),
    showStatusChange: z.boolean(),
    showStatusVolume: z.boolean(),
    autoScale: z.boolean(),
    scaleMode: z.enum(['linear', 'log', 'percent']),
    invertScale: z.boolean(),
    lockScale: z.boolean(),
    scalePriceChartOnly: z.boolean(),
    showLastPriceLine: z.boolean(),
    showLastPriceLabel: z.boolean(),
    showPrevCloseLine: z.boolean(),
    backgroundType: z.enum(['solid', 'gradient']),
    gridVertical: z.boolean(),
    gridHorizontal: z.boolean(),
    crosshairMode: z.enum(['full', 'dot', 'arrow']),
    crosshairLineStyle: z.enum(LINE_STYLES),
    watermarkVisible: z.boolean(),
    watermarkText: z.string().max(80),
    fontSize: z.number().min(8).max(20),
    volumeVisible: z.boolean(),
    volumePaneRatio: z.number().min(volume.minRatio).max(volume.maxRatio),
    rightMargin: z.number().min(0).max(200),
    marginTop: z.number().min(0).max(40),
    marginBottom: z.number().min(0).max(40),
    hiDpi: z.boolean(),
  })
  .partial();

export function parseChartOptions(data: unknown): ChartOptions | null {
  const r = chartOptionsSchema.safeParse(data);
  if (!r.success) return null;
  const clean = Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined));
  return { ...DEFAULT_CHART_OPTIONS, ...clean };
}
