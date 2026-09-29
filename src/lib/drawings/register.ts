import { drawingRegistry } from './framework/registry';
import { curveTool } from './tools/curve';
import { highlighterTool } from './tools/highlighter';
import { pathTool } from './tools/path';
import { rectangleTool } from './tools/rectangle';
import { textTool } from './tools/text';
import { trendLineTool } from './tools/trend-line';

/**
 * The single place where drawing tools are registered. Order = toolbar order.
 * To add a tool: create tools/<name>/ (see tools/_template) and add one line here.
 */
drawingRegistry
  .register(trendLineTool)
  .register(rectangleTool)
  .register(pathTool)
  .register(curveTool)
  .register(textTool)
  .register(highlighterTool);
