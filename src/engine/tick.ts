import { isGate } from './parse';
import type { Dir, GameEvent, Level, State, W } from './types';

const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Neighbour cell index, or -1 off the board. */
export function step(lv: Level, i: number, d: Dir): number {
  const x = (i % lv.w) + DELTA[d][0], y = Math.floor(i / lv.w) + DELTA[d][1];
  return x < 0 || y < 0 || x >= lv.w || y >= lv.h ? -1 : y * lv.w + x;
}

export const occupied = (s: State, w: W, i: number) => s.pos[w] === i || s.objs[w][i] !== ' ';

export function linkActive(lv: Level, s: State, letter: string): boolean {
  const w = lv.owner[letter];
  return lv.plates[letter].some((i) => occupied(s, w, i));
}

/** RULES.md §5: open if it wants to be, or jammed open by an occupant. */
export function gateOpen(lv: Level, s: State, w: W, i: number): boolean {
  const l = s.tiles[w][i].toLowerCase();
  const active = linkActive(lv, s, l);
  return (lv.owner[l] === w ? active : !active) || occupied(s, w, i);
}

/** Gate that wants to be closed but is held open by an occupant. */
export function gateJammed(lv: Level, s: State, w: W, i: number): boolean {
  const l = s.tiles[w][i].toLowerCase();
  const active = linkActive(lv, s, l);
  return !(lv.owner[l] === w ? active : !active) && occupied(s, w, i);
}

function solid(lv: Level, s: State, w: W, i: number): boolean {
  const c = s.tiles[w][i];
  return c === '#' || c === '|' || (isGate(c) && !gateOpen(lv, s, w, i));
}

export function isWon(s: State): boolean {
  return !s.fallen[0] && !s.fallen[1] && s.tiles[0][s.pos[0]] === 'G' && s.tiles[1][s.pos[1]] === 'G';
}

/** RULES.md §4. Pure: never mutates `s`. Pass `ev` to collect animation events. */
export function tick(lv: Level, s: State, dir: Dir, ev?: GameEvent[]): State {
  if (s.fallen[0] || s.fallen[1] || isWon(s)) return s;
  const tiles = [[...s.tiles[0]], [...s.tiles[1]]];
  const objs = [[...s.objs[0]], [...s.objs[1]]];
  const pos: [number, number] = [s.pos[0], s.pos[1]];
  const stomps: [W, number][] = [];

  // Step 2: movement, judged against the start-of-tick state.
  for (const w of [0, 1] as W[]) {
    const to = step(lv, s.pos[w], dir);
    if (to < 0) { ev?.push({ type: 'bump', world: w, at: s.pos[w] }); continue; }
    if (s.objs[w][to] === '@') { pos[w] = to; continue; } // walks into it: caught below
    if (s.objs[w][to] === '?') { ev?.push({ type: 'bump', world: w, at: s.pos[w] }); continue; }
    if (s.objs[w][to] !== ' ') {
      const beyond = step(lv, to, dir);
      if (beyond < 0 || solid(lv, s, w, beyond) || s.objs[w][beyond] !== ' ') {
        ev?.push({ type: 'bump', world: w, at: s.pos[w] });
        continue;
      }
      objs[w][to] = ' ';
      if (s.tiles[w][beyond] === '^') {
        tiles[w][beyond] = '.';
        ev?.push({ type: 'fill', world: w, at: beyond });
      } else objs[w][beyond] = s.objs[w][to];
      pos[w] = to;
      ev?.push({ type: 'push', world: w, at: to });
      continue;
    }
    if (s.tiles[w][to] === '|') { stomps.push([w, to]); continue; }
    if (solid(lv, s, w, to)) { ev?.push({ type: 'bump', world: w, at: s.pos[w] }); continue; }
    pos[w] = to;
    ev?.push({ type: 'move', world: w, at: to });
  }

  // Step 2, end: the Tarnish (RULES.md §5a).
  // Entering a pit is decided now: a Tarnish filling it later this tick can't save you.
  const fell = [tiles[0][pos[0]] === '^', tiles[1][pos[1]] === '^'];
  const caught = [objs[0][pos[0]] === '@', objs[1][pos[1]] === '@'];
  if (pos[0] === pos[1] && s.pos[0] !== s.pos[1]) {
    for (const w of [0, 1] as W[]) objs[w].forEach((o, i) => {
      if (o === '@' || o === '?') { objs[w][i] = o === '@' ? '?' : '@'; ev?.push({ type: 'flip', world: w, at: i }); }
    });
  } else {
    for (const w of [0, 1] as W[]) {
      const awake = objs[w].flatMap((o, i) => (o === '@' ? [i] : []));
      for (const i of awake) {
        const dx = (pos[w] % lv.w) - (i % lv.w), dy = Math.floor(pos[w] / lv.w) - Math.floor(i / lv.w);
        const h: Dir | null = dx ? (dx > 0 ? 'right' : 'left') : null, v: Dir | null = dy ? (dy > 0 ? 'down' : 'up') : null;
        const tries = Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
        for (const d of tries) {
          const to = d ? step(lv, i, d) : -1;
          if (to < 0 || solid(lv, s, w, to) || objs[w][to] !== ' ') continue;
          objs[w][i] = ' ';
          if (tiles[w][to] === '^') { tiles[w][to] = '.'; ev?.push({ type: 'foeFall', world: w, at: to }); }
          else { objs[w][to] = '@'; ev?.push({ type: 'foeStep', world: w, at: to }); }
          break;
        }
      }
    }
  }
  for (const w of [0, 1] as W[]) caught[w] ||= objs[w][pos[w]] === '@';

  // Step 4: seesaw stomps use post-movement occupancy. Gates are derived, nothing to do.
  for (const [w, i] of stomps) {
    const o = (1 - w) as W;
    if (pos[o] === i || objs[o][i] !== ' ') { ev?.push({ type: 'stompJam', world: w, at: i }); continue; }
    tiles[w][i] = '/';
    tiles[o][i] = '|';
    ev?.push({ type: 'stomp', world: w, at: i });
  }

  // Step 7: falls.
  const fallen: [boolean, boolean] = [fell[0] || caught[0], fell[1] || caught[1]];
  fallen.forEach((f, w) => f && ev?.push({ type: caught[w] ? 'caught' : 'fall', world: w as W, at: pos[w] }));

  return {
    tiles: [tiles[0].join(''), tiles[1].join('')],
    objs: [objs[0].join(''), objs[1].join('')],
    pos,
    fallen,
  };
}

export const hashState = (s: State) => `${s.pos[0]},${s.pos[1]}|${s.tiles[0]}|${s.tiles[1]}|${s.objs[0]}|${s.objs[1]}`;
