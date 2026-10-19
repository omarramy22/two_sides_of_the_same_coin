export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

/** 0 = Heads (Sol), 1 = Tails (Lune). */
export type W = 0 | 1;

export type Role = 'introduce' | 'develop' | 'twist' | 'combine' | 'capstone' | 'finale';

export interface LevelFile {
  id: string;
  name: string;
  role: Role;
  designNote: string;
  heads: string[];
  tails: string[];
  hints: (string | null)[];
  /** Optimal move count, written by `npm run verify-levels`. */
  par?: number;
}

export interface Level extends Omit<LevelFile, 'heads' | 'tails'> {
  w: number;
  h: number;
  /** Plate cell indices per link letter (lowercase), all in `owner[letter]`'s world. */
  plates: Record<string, number[]>;
  owner: Record<string, W>;
  start: State;
}

/**
 * Everything that can change. Cells are indexed `y * w + x`.
 * `tiles` is the terrain (walls, gates, seesaw ends, pits...); `objs` is ' ' or 'C' per cell.
 * Gate open/closed is derived, never stored (RULES.md §5).
 */
export interface State {
  tiles: [string, string];
  objs: [string, string];
  pos: [number, number];
  fallen: [boolean, boolean];
}

export type GameEvent =
  | { type: 'move' | 'bump' | 'push' | 'fill' | 'stomp' | 'stompJam' | 'fall'; world: W; at: number };
