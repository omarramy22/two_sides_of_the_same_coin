import type { Level, LevelFile, Role, W } from './types';

/** Reserved letters are never link letters (RULES.md §2.1). */
const RESERVED = 'CGLMOQS';
const ROLES: Role[] = ['introduce', 'develop', 'twist', 'combine', 'capstone', 'finale'];
// Glyphs implemented so far (Ch1-4). Later chapters extend this.
const BASIC = '#.SLGC^/|@?*=-~_&0';

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
  const raw = worlds.map((rows) => rows.join('')) as [string, string];
  // `0` is a crate standing on a dry basin cell; everywhere else it reads as `_` + `C`.
  const grids = raw.map((g) => g.replaceAll('0', '_')) as [string, string];

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

  // Basins (§2.2 rules 5 and 6): same mask both sides, one unit of water per cell.
  const basin = (i: number) => '~_'.includes(grids[0][i]);
  for (let i = 0; i < w * h; i++) {
    const a = grids[0][i], b = grids[1][i];
    if (('~_'.includes(a) || '~_'.includes(b)) && !((a === '~' && b === '_') || (a === '_' && b === '~'))) {
      fail(`basin at ${i % w},${Math.floor(i / w)} must be '~' on one side and '_' on the other`);
    }
  }
  const regionOf = new Map<number, number>(), basins: number[][] = [];
  const near = (i: number) => [i - w, i + w, i % w ? i - 1 : -1, i % w < w - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < w * h);
  for (let i = 0; i < w * h; i++) {
    if (!basin(i) || regionOf.has(i)) continue;
    const r = basins.length, cells = [i];
    regionOf.set(i, r);
    for (let k = 0; k < cells.length; k++) for (const j of near(cells[k])) if (basin(j) && !regionOf.has(j)) { regionOf.set(j, r); cells.push(j); }
    basins.push(cells.sort((x, y) => x - y));
  }
  const sluices: Level['sluices'] = [];
  grids.forEach((g, wi) => [...g].forEach((c, i) => {
    if (c !== '&') return;
    const rs = new Set(near(i).filter(basin).map((j) => regionOf.get(j)!));
    if (rs.size !== 1) fail(`sluice at ${i % w},${Math.floor(i / w)} must touch exactly one basin`);
    sluices.push({ w: wi as W, i, region: [...rs][0] });
  }));

  const tiles = grids.map((g) => g.replace(/[SLC@?*]/g, '.')) as [string, string];
  const objs = raw.map((g) => g.replace(/0/g, 'C').replace(/[^C@?*]/g, ' ')) as [string, string];
  return {
    id: f.id, name: f.name, role: f.role, designNote: f.designNote, hints: f.hints, par: f.par,
    w, h, plates, owner, basins, sluices,
    start: { tiles, objs, pos: [grids[0].indexOf('S'), grids[1].indexOf('L')], fallen: [false, false] },
  };
}
