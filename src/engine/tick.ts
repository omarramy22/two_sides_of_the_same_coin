import { isGate } from './parse';
import { DIRS, type Dir, type GameEvent, type Level, type State, type W } from './types';

const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Neighbour cell index, or -1 off the board. */
export function step(lv: Level, i: number, d: Dir): number {
  const x = (i % lv.w) + DELTA[d][0], y = Math.floor(i / lv.w) + DELTA[d][1];
  return x < 0 || y < 0 || x >= lv.w || y >= lv.h ? -1 : y * lv.w + x;
}

export const occupied = (s: State, w: W, i: number) => s.pos[w] === i || s.objs[w][i] !== ' ';
/** Something with weight is on it (§9.2): a weightless character still occupies, but presses nothing. */
export const weighted = (s: State, w: W, i: number) => (s.pos[w] === i && s.traded[w] !== 'O') || s.objs[w][i] !== ' ';

export function linkActive(lv: Level, s: State, letter: string): boolean {
  const w = lv.owner[letter];
  return lv.plates[letter].some((i) => weighted(s, w, i));
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
  return c === '#' || c === '|' || c === '~' || (isGate(c) && !gateOpen(lv, s, w, i));
}

/**
 * RULES.md §7, per world and cell: 1 lit, -1 shadowed, 0 neither (dark or eclipse).
 * Beams stop at walls, closed gates and raised stones; a crate or lantern catches the beam
 * (its own tile is lit) and stops it.
 */
export function light(lv: Level, s: State): [Int8Array, Int8Array] {
  const n = lv.w * lv.h, raw = [new Uint8Array(n), new Uint8Array(n)];
  for (const w of [0, 1] as W[]) {
    for (let i = 0; i < n; i++) {
      if (s.objs[w][i] !== '*') continue;
      raw[w][i] = 1;
      for (const d of DIRS) {
        for (let j = step(lv, i, d); j >= 0 && !solid(lv, s, w, j); j = step(lv, j, d)) {
          raw[w][j] = 1;
          if (s.objs[w][j] === 'C' || s.objs[w][j] === '*') break;
        }
      }
    }
    // A light-bearer (§9.1) lights her own tile and its four neighbours, no beams.
    if (s.traded[w] === 'Q') for (const j of [s.pos[w], ...DIRS.map((d) => step(lv, s.pos[w], d))]) if (j >= 0) raw[w][j] = 1;
  }
  const out: [Int8Array, Int8Array] = [new Int8Array(n), new Int8Array(n)];
  for (let i = 0; i < n; i++) {
    const d = raw[0][i] - raw[1][i];
    out[0][i] = d;
    out[1][i] = -d;
  }
  return out;
}

/** Any light source at all: lanterns or a light-bearer. */
export const hasLight = (s: State) => s.objs[0].includes('*') || s.objs[1].includes('*') || s.traded.includes('Q');
/** A mirage `=` stands while lit, a shadow bridge `-` while shadowed; otherwise it's a hole (§7). */
export const voidBridge = (c: string, l: number) => (c === '=' && l !== 1) || (c === '-' && l !== -1);

/** §4 step 8; in the finale (§9.3) both stand on their wish altar `$` and still hold their coins. */
export function isWon(s: State): boolean {
  if (s.fallen[0] || s.fallen[1]) return false;
  const [a, b] = [s.tiles[0][s.pos[0]], s.tiles[1][s.pos[1]]];
  return (a === 'G' && b === 'G') || (a === '$' && b === '$' && !s.traded[0] && !s.traded[1]);
}

/**
 * Where the awake Tarnish at `i` steps toward `target` (RULES.md §5a), or -1 if it stays.
 * Terrain is judged at the start of the tick (`s`); bodies by the current `objs` row.
 */
function foeStep(lv: Level, s: State, objs: ArrayLike<string>, w: W, i: number, target: number): number {
  const dx = (target % lv.w) - (i % lv.w), dy = Math.floor(target / lv.w) - Math.floor(i / lv.w);
  const h: Dir | null = dx ? (dx > 0 ? 'right' : 'left') : null, v: Dir | null = dy ? (dy > 0 ? 'down' : 'up') : null;
  for (const d of Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h]) {
    const to = d ? step(lv, i, d) : -1;
    if (to >= 0 && !solid(lv, s, w, to) && objs[to] === ' ') return to;
  }
  return -1;
}

/**
 * RULES.md §8: each basin region with an open sluice in world W sends one unit of W's water across
 * the seam: the flooded cell nearest an open sluice (ties: reading order) whose twin is free.
 * Both directions are picked from the pre-flow water, then applied. Rafts take a cell out of the tides.
 */
function flow(lv: Level, tiles: string[][], objs: string[][], pos: [number, number], traded: [string, string], ev?: GameEvent[]) {
  const moves: [W, number][] = [];
  lv.basins.forEach((cells, r) => {
    for (const w of [0, 1] as W[]) {
      const open = lv.sluices.filter((sl) => sl.w === w && sl.region === r && ((pos[w] === sl.i && traded[w] !== 'O') || objs[w][sl.i] !== ' '));
      if (!open.length) continue;
      const o = (1 - w) as W, inRegion = new Set(cells);
      // BFS through the region, starting from the cells beside an open sluice.
      const dist = new Map<number, number>(), queue: number[] = [];
      for (const sl of open) for (const d of DIRS) {
        const j = step(lv, sl.i, d);
        if (inRegion.has(j) && !dist.has(j)) { dist.set(j, 0); queue.push(j); }
      }
      for (let k = 0; k < queue.length; k++) for (const d of DIRS) {
        const j = step(lv, queue[k], d);
        if (inRegion.has(j) && !dist.has(j)) { dist.set(j, dist.get(queue[k])! + 1); queue.push(j); }
      }
      const free = (i: number) => tiles[w][i] === '~' && tiles[o][i] === '_' && pos[o] !== i && (objs[o][i] === ' ' || objs[o][i] === 'C');
      const pick = cells.filter(free).sort((a, b) => dist.get(a)! - dist.get(b)! || a - b)[0];
      if (pick !== undefined) moves.push([w, pick]);
    }
  });
  for (const [w, i] of moves) {
    const o = (1 - w) as W;
    tiles[w][i] = '_';
    tiles[o][i] = '~';
    ev?.push({ type: 'flow', world: w, at: i });
    if (objs[o][i] === 'C') { objs[o][i] = ' '; tiles[o][i] = '+'; ev?.push({ type: 'raft', world: o, at: i }); }
  }
}

/** RULES.md §4. Pure: never mutates `s`. Pass `ev` to collect animation events. */
export function tick(lv: Level, s: State, dir: Dir, ev?: GameEvent[]): State {
  if (s.fallen[0] || s.fallen[1] || isWon(s)) return s;
  const tiles = [[...s.tiles[0]], [...s.tiles[1]]];
  const objs = [[...s.objs[0]], [...s.objs[1]]];
  const pos: [number, number] = [s.pos[0], s.pos[1]];
  const traded: [string, string] = [s.traded[0], s.traded[1]];
  const stomps: [W, number][] = [];
  // Bridges only matter when they exist; light is derived from the start-of-tick state for pushes.
  const bridges = /[=-]/.test(s.tiles[0] + s.tiles[1]);
  const lit0 = bridges ? light(lv, s) : null;
  const now = (): State => ({ tiles: [tiles[0].join(''), tiles[1].join('')], objs: [objs[0].join(''), objs[1].join('')], pos, traded, mirror, fallen: s.fallen });

  // Step 2: movement, judged against the start-of-tick state.
  // Step 1: intent. In the mirror, Lune's left is right.
  const flipLR: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'up', down: 'down' };
  for (const w of [0, 1] as W[]) {
    const to = step(lv, s.pos[w], w && s.mirror ? flipLR[dir] : dir);
    if (to < 0) { ev?.push({ type: 'bump', world: w, at: s.pos[w] }); continue; }
    if (s.objs[w][to] === '@') { pos[w] = to; continue; } // walks into it: caught below
    if (s.objs[w][to] === '?') { ev?.push({ type: 'bump', world: w, at: s.pos[w] }); continue; }
    if (s.objs[w][to] !== ' ') {
      const beyond = step(lv, to, w && s.mirror ? flipLR[dir] : dir);
      if (beyond >= 0 && s.objs[w][to] === 'C' && s.tiles[w][beyond] === '~' && s.objs[w][beyond] === ' ') {
        // A crate pushed into water floats: a raft, walkable for good (§4.1).
        objs[w][to] = ' ';
        tiles[w][beyond] = '+';
        ev?.push({ type: 'raft', world: w, at: beyond, from: to });
        pos[w] = to;
        continue;
      }
      if (beyond < 0 || solid(lv, s, w, beyond) || s.objs[w][beyond] !== ' ' || (lit0 && voidBridge(s.tiles[w][beyond], lit0[w][beyond]))) {
        ev?.push({ type: 'bump', world: w, at: s.pos[w] });
        continue;
      }
      objs[w][to] = ' ';
      if (s.tiles[w][beyond] === '^' || s.tiles[w][beyond] === '%') {
        tiles[w][beyond] = ',';
        ev?.push({ type: 'fill', world: w, at: beyond, from: to });
      } else {
        objs[w][beyond] = s.objs[w][to];
        ev?.push({ type: 'push', world: w, at: beyond, from: to });
      }
      pos[w] = to;
      continue;
    }
    if (s.tiles[w][to] === '|' && s.traded[w] !== 'O') { stomps.push([w, to]); continue; }
    if (solid(lv, s, w, to)) { ev?.push({ type: 'bump', world: w, at: s.pos[w] }); continue; }
    pos[w] = to;
    ev?.push({ type: 'move', world: w, at: to });
    // Cracked floor gives way under weight (§4 step 2): it's a pit from now on.
    if (s.tiles[w][to] === '%' && s.traded[w] !== 'O') { tiles[w][to] = '^'; ev?.push({ type: 'crack', world: w, at: to }); }
  }

  // Mirror shrines: each entry toggles the mirror, so two in one tick cancel out.
  let mirror = s.mirror;
  for (const w of [0, 1] as W[]) {
    if (pos[w] === s.pos[w] || tiles[w][pos[w]] !== 'M') continue;
    mirror = !mirror;
    ev?.push({ type: 'mirror', world: w, at: pos[w] });
  }

  // Altars (§9.1): stepping onto an unused one with your coin trades it.
  for (const w of [0, 1] as W[]) {
    const c = tiles[w][pos[w]];
    if (pos[w] === s.pos[w] || (c !== 'O' && c !== 'Q') || traded[w]) continue;
    traded[w] = c;
    tiles[w][pos[w]] = c === 'O' ? '(' : ')';
    ev?.push({ type: 'altar', world: w, at: pos[w] });
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
    // Frozen by light (§5a): a Tarnish standing in its own world's light, after the pushes, doesn't step.
    const lit = hasLight(now()) ? light(lv, now()) : null;
    for (const w of [0, 1] as W[]) {
      const awake = objs[w].flatMap((o, i) => (o === '@' ? [i] : []));
      for (const i of awake) {
        if (lit?.[w][i] === 1) continue;
        const to = foeStep(lv, s, objs[w], w, i, pos[w]);
        if (to < 0) continue;
        objs[w][i] = ' ';
        // Onto a character it's a catch, whatever the floor; otherwise a hole swallows it.
        if (to !== pos[w] && (tiles[w][to] === '^' || tiles[w][to] === '%')) { tiles[w][to] = ';'; ev?.push({ type: 'foeFall', world: w, at: to, from: i }); }
        else { objs[w][to] = '@'; ev?.push({ type: 'foeStep', world: w, at: to, from: i }); }
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

  // Step 6: water (§8).
  if (lv.sluices.length) flow(lv, tiles, objs, pos, traded, ev);

  // Steps 5 and 7: light, then anything on a void bridge falls. A lost lantern changes the light,
  // so repeat until nothing more drops.
  if (bridges) {
    for (let lit = light(lv, now()), dropped = true; dropped; ) {
      dropped = false;
      for (const w of [0, 1] as W[]) objs[w].forEach((o, i) => {
        if (o === ' ' || !voidBridge(tiles[w][i], lit[w][i])) return;
        objs[w][i] = ' ';
        dropped = true;
        ev?.push({ type: 'drop', world: w, at: i });
      });
      if (dropped) lit = light(lv, now());
      else for (const w of [0, 1] as W[]) fell[w] ||= voidBridge(tiles[w][pos[w]], lit[w][pos[w]]);
    }
  }

  // Step 7: falls.
  const fallen: [boolean, boolean] = [fell[0] || caught[0], fell[1] || caught[1]];
  fallen.forEach((f, w) => f && ev?.push({ type: caught[w] ? 'caught' : 'fall', world: w as W, at: pos[w] }));

  return {
    tiles: [tiles[0].join(''), tiles[1].join('')],
    objs: [objs[0].join(''), objs[1].join('')],
    pos,
    traded,
    mirror,
    fallen,
  };
}

export const hashState = (s: State) => `${s.pos[0]},${s.pos[1]},${s.traded[0]},${s.traded[1]},${+s.mirror}|${s.tiles[0]}|${s.tiles[1]}|${s.objs[0]}|${s.objs[1]}`;
