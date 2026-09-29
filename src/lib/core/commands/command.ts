/** A reversible state mutation. Everything that changes user-visible state is a Command. */
export interface Command {
  readonly label: string;
  execute(): void;
  undo(): void;
  /**
   * Optionally absorb a directly following command (e.g. repeated style tweaks from one
   * control). Return true if merged; `next` is then discarded.
   */
  merge?(next: Command): boolean;
}

/** Groups commands so they undo/redo as one step. */
export class CompositeCommand implements Command {
  constructor(
    readonly label: string,
    private readonly commands: readonly Command[],
  ) {}

  execute(): void {
    for (const c of this.commands) c.execute();
  }

  undo(): void {
    for (let i = this.commands.length - 1; i >= 0; i--) this.commands[i]!.undo();
  }
}
