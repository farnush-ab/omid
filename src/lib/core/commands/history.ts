import type { Command } from './command';

export interface HistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
  /** Increments on every change; persistence uses it to detect edits. */
  readonly revision: number;
}

type Listener = (state: HistoryState) => void;

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private listeners = new Set<Listener>();
  private revision = 0;
  private mergeWindowOpen = false;

  constructor(private readonly limit = 200) {}

  /** Executes and records `command`. `mergeable` allows merging with the previous command. */
  execute(command: Command, options: { mergeable?: boolean } = {}): void {
    command.execute();
    const prev = this.undoStack[this.undoStack.length - 1];
    if (options.mergeable && this.mergeWindowOpen && prev?.merge?.(command)) {
      // merged into prev
    } else {
      this.undoStack.push(command);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.mergeWindowOpen = options.mergeable ?? false;
    this.redoStack = [];
    this.changed();
  }

  /** Stops the next mergeable command from merging into the previous one. */
  sealMerge(): void {
    this.mergeWindowOpen = false;
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    this.mergeWindowOpen = false;
    this.changed();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    this.mergeWindowOpen = false;
    this.changed();
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.changed();
  }

  get state(): HistoryState {
    const u = this.undoStack[this.undoStack.length - 1];
    const r = this.redoStack[this.redoStack.length - 1];
    return {
      canUndo: !!u,
      canRedo: !!r,
      undoLabel: u?.label ?? null,
      redoLabel: r?.label ?? null,
      revision: this.revision,
    };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.revision += 1;
    const s = this.state;
    for (const l of this.listeners) l(s);
  }
}
