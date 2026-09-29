import { z } from 'zod';
import { zColor, zFontSize, zHAlign, zLineWidth, zOpacity } from '../../framework';

export const textStyleSchema = z.object({
  text: z.string().max(5000),
  color: zColor,
  fontFamily: z.string().min(1).max(120),
  fontSize: zFontSize,
  bold: z.boolean(),
  italic: z.boolean(),
  align: zHAlign,
  bgEnabled: z.boolean(),
  bgColor: zColor,
  bgOpacity: zOpacity,
  borderEnabled: z.boolean(),
  borderColor: zColor,
  borderWidth: zLineWidth,
  wrap: z.boolean(),
  boxWidth: z.number().min(0).max(4000),
  padding: z.number().min(0).max(64),
  rotation: z.number().min(-180).max(180),
});

export type TextStyle = z.infer<typeof textStyleSchema>;

export const TEXT_DEFAULTS: TextStyle = {
  text: 'Text',
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  bold: false,
  italic: false,
  align: 'left',
  bgEnabled: false,
  bgColor: '#2962ff',
  bgOpacity: 0.25,
  borderEnabled: false,
  borderColor: '#2962ff',
  borderWidth: 1,
  wrap: false,
  boxWidth: 0,
  padding: 4,
  rotation: 0,
};
