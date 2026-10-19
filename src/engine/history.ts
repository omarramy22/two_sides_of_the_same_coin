import type { State } from './types';

/** Undo stack. Restart is pushed like a move, so it can be undone too (RULES.md §11.12). */
export class History {
  private stack: { state: State; moves: number }[];
  constructor(private start: State) { this.stack = [{ state: start, moves: 0 }]; }
  get state() { return this.stack[this.stack.length - 1].state; }
  get moves() { return this.stack[this.stack.length - 1].moves; }
  /** Every input counts as a turn, even a double bump. */
  push(s: State) { if (s !== this.state) this.stack.push({ state: s, moves: this.moves + 1 }); }
  undo(): boolean { return this.stack.length > 1 && !!this.stack.pop(); }
  restart() { if (this.state !== this.start) this.stack.push({ state: this.start, moves: 0 }); }
}
