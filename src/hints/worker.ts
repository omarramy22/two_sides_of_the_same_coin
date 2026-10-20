// Hint tier 3 (SPEC.md §4.5): solve from the player's state off the main thread.
// Given states newest-first, finds the newest one that is still solvable.
import { levels } from '../levels';
import { solve } from '../solver/solve';
import type { Dir, State } from '../engine/types';

export interface HintRequest { id: number; level: string; states: State[] }
export interface HintReply { id: number; back: number; path: Dir[] }

self.onmessage = (e: MessageEvent<HintRequest>) => {
  const { id, level, states } = e.data;
  const lv = levels.find((l) => l.id === level);
  if (lv) for (let back = 0; back < states.length; back++) {
    const sol = solve(lv, states[back], 400_000);
    if (sol) return postMessage({ id, back, path: sol.path } satisfies HintReply);
  }
  postMessage({ id, back: -1, path: [] } satisfies HintReply);
};
