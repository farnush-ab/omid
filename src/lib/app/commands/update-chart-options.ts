import type { ChartEngine, ChartOptions, Command } from '@/lib/core';

/** Undoable chart-options change. Consecutive tweaks of the same keys merge into one step. */
export class UpdateChartOptionsCommand implements Command {
  readonly label = 'Change chart settings';

  constructor(
    private readonly engine: ChartEngine,
    private readonly before: Partial<ChartOptions>,
    private after: Partial<ChartOptions>,
  ) {}

  execute(): void {
    this.engine.setOptions(this.after);
  }

  undo(): void {
    this.engine.setOptions(this.before);
  }

  merge(next: Command): boolean {
    if (!(next instanceof UpdateChartOptionsCommand)) return false;
    const sameKeys = Object.keys(next.after).every((k) => k in this.after);
    if (!sameKeys) return false;
    this.after = { ...this.after, ...next.after };
    return true;
  }
}
