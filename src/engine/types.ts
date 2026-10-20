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
 * `tiles` is the terrain (walls, gates, seesaw ends, pits...).
 * `objs` per cell: ' ' empty, 'C' crate, '*' lantern, '@' awake Tarnish, '?' asleep Tarnish.
 * Gate open/closed and light are derived, never stored (RULES.md §5, §7).
 */
export interface State {
  tiles: [string, string];
  objs: [string, string];
  pos: [number, number];
  fallen: [boolean, boolean];
}

/**
 * Animation hints from `tick`. `at` is where it happened. Things that slide also carry `from`:
 * push/fill = the crate's move (fill: into a pit), foeStep/foeFall = a Tarnish's step,
 * drop = an object lost through a bridge that went void (§7).
 */
export type GameEvent = {
  type: 'move' | 'bump' | 'push' | 'fill' | 'stomp' | 'stompJam' | 'fall' | 'caught' | 'flip' | 'foeStep' | 'foeFall' | 'drop';
  world: W;
  at: number;
  from?: number;
};
