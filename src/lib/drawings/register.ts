import { drawingRegistry } from './framework/registry';
import { rectangleTool } from './tools/rectangle';
import { trendLineTool } from './tools/trend-line';

/**
 * The single place where drawing tools are registered. Order = toolbar order.
 * To add a tool: create tools/<name>/ (see tools/_template) and add one line here.
 */
drawingRegistry.register(trendLineTool).register(rectangleTool);
