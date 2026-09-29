import { z } from 'zod';
import { zColor, zLineWidth, zOpacity } from '../../framework';

export const positionStyleSchema = z.object({
  accountSize: z.number().min(0),
  lotSize: z.number().positive(),
  riskMode: z.enum(['percent', 'amount']),
  risk: z.number().min(0),
  leverage: z.number().min(1).max(1000),
  compact: z.boolean(),
  alwaysShowStats: z.boolean(),
  showPriceLabels: z.boolean(),
  profitColor: zColor,
  profitOpacity: zOpacity,
  lossColor: zColor,
  lossOpacity: zOpacity,
  lineColor: zColor,
  lineWidth: zLineWidth,
  profitLabelColor: zColor,
  lossLabelColor: zColor,
  textColor: zColor,
});

export type PositionStyle = z.infer<typeof positionStyleSchema>;

export const POSITION_DEFAULTS: PositionStyle = {
  accountSize: 10_000,
  lotSize: 1,
  riskMode: 'percent',
  risk: 1,
  leverage: 1,
  compact: false,
  alwaysShowStats: true,
  showPriceLabels: true,
  profitColor: '#089981',
  profitOpacity: 0.2,
  lossColor: '#f23645',
  lossOpacity: 0.2,
  lineColor: '#787b86',
  lineWidth: 1,
  profitLabelColor: '#089981',
  lossLabelColor: '#f23645',
  textColor: '#ffffff',
};
