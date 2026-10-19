import { hashState, isWon, tick } from '../engine/tick';
import { DIRS, type Dir, type Level, type State } from '../engine/types';

export interface Solution {
  path: Dir[];
  /** Distinct states reached. */
  explored: number;
  /** Distinct optimal move sequences, capped at COUNT_CAP. */
  optimalCount: number;
}

export const COUNT_CAP = 1000;

/** Layered BFS over `tick`. Fallen states are dead ends. Returns null if unsolvable within `maxStates`. */
export function solve(lv: Level, start: State = lv.start, maxStates = 3_000_000): Solution | null {
  const info = new Map<string, { depth: number; count: number; prev: string | null; dir: Dir | null }>();
  info.set(hashState(start), { depth: 0, count: 1, prev: null, dir: null });
  let frontier = [start];
  for (let depth = 0; frontier.length && info.size < maxStates; depth++) {
    const wins = frontier.filter(isWon);
    if (wins.length) {
      const path: Dir[] = [];
      for (let e = info.get(hashState(wins[0]))!; e.prev !== null; e = info.get(e.prev)!) path.unshift(e.dir!);
      const optimalCount = Math.min(COUNT_CAP, wins.reduce((n, s) => n + info.get(hashState(s))!.count, 0));
      return { path, explored: info.size, optimalCount };
    }
    const next: State[] = [];
    for (const s of frontier) {
      const k = hashState(s), from = info.get(k)!;
      for (const dir of DIRS) {
        const t = tick(lv, s, dir);
        if (t.fallen[0] || t.fallen[1]) continue;
        const tk = hashState(t), e = info.get(tk);
        if (!e) {
          info.set(tk, { depth: depth + 1, count: from.count, prev: k, dir });
          next.push(t);
        } else if (e.depth === depth + 1) e.count = Math.min(COUNT_CAP, e.count + from.count);
      }
    }
    frontier = next;
  }
  return null;
}
