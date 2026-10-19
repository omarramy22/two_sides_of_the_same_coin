import type { Level, LevelFile, Role, W } from './types';

/** Reserved letters are never link letters (RULES.md §2.1). */
const RESERVED = 'CGLMOQS';
const ROLES: Role[] = ['introduce', 'develop', 'twist', 'combine', 'capstone', 'finale'];
// Glyphs implemented so far (Ch1-2). Later chapters extend this.
const BASIC = '#.SLGC^/|@?';

export const isPlate = (c: string) => c >= 'a' && c <= 'z' && !RESERVED.includes(c.toUpperCase());
export const isGate = (c: string) => c >= 'A' && c <= 'Z' && !RESERVED.includes(c);

export function parseLevel(f: LevelFile): Level {
  const fail = (msg: string): never => { throw new Error(`level ${f.id}: ${msg}`); };
  if (!ROLES.includes(f.role)) fail(`bad role "${f.role}"`);
  const worlds = [f.heads, f.tails];
  const h = f.heads.length, w = f.heads[0]?.length ?? 0;
  for (const rows of worlds) {
    if (rows.length !== h || rows.some((r) => r.length !== w)) fail('both worlds must be rectangles of the same size');
  }
  const grids = worlds.map((rows) => rows.join('')) as [string, string];

  const count = (g: string, c: string) => g.split(c).length - 1;
  if (count(grids[0], 'S') !== 1 || count(grids[1], 'S') !== 0) fail('need exactly one S, in heads');
  if (count(grids[1], 'L') !== 1 || count(grids[0], 'L') !== 0) fail('need exactly one L, in tails');
  if (count(grids[0], 'G') !== 1 || count(grids[1], 'G') !== 1) fail('need exactly one G per world');

  const plates: Record<string, number[]> = {};
  const owner: Record<string, W> = {};
  const gates = new Set<string>();
  grids.forEach((g, wi) => {
    [...g].forEach((c, i) => {
      if (isPlate(c)) {
        if (c in owner && owner[c] !== wi) fail(`plates "${c}" must all be in one world`);
        owner[c] = wi as W;
        (plates[c] ??= []).push(i);
      } else if (isGate(c)) gates.add(c.toLowerCase());
      else if (!BASIC.includes(c)) fail(`unknown glyph "${c}"`);
      if (c === '/' || c === '|') {
        const twin = grids[1 - wi][i];
        if (twin !== (c === '/' ? '|' : '/')) fail(`seesaw at ${i % w},${Math.floor(i / w)} needs a '/' and '|' twin pair`);
      }
    });
  });
  for (const l of gates) if (!(l in owner)) fail(`gate "${l.toUpperCase()}" has no plate`);
  for (const l in owner) if (!gates.has(l)) fail(`plate "${l}" has no gate`);

  const tiles = grids.map((g) => g.replace(/[SLC@?]/g, '.')) as [string, string];
  const objs = grids.map((g) => g.replace(/[^C@?]/g, ' ')) as [string, string];
  return {
    id: f.id, name: f.name, role: f.role, designNote: f.designNote, hints: f.hints, par: f.par,
    w, h, plates, owner,
    start: { tiles, objs, pos: [grids[0].indexOf('S'), grids[1].indexOf('L')], fallen: [false, false] },
  };
}
