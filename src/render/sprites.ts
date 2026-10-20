// Phase 2 art layer: tile/actor sprites from assets/manifest.json (see art/STYLE.md). No game rules.
import { Container, Sprite, TilingSprite, type Texture } from 'pixi.js';
import { light, voidBridge } from '../engine/tick';
import type { Level, State, W } from '../engine/types';
import { loadManifest, loadPuppet, texture, type Puppet } from './rig';

export interface Art {
  tex: Record<string, Texture>;
  sol: Puppet;
  lune: Puppet;
}

/** Tile palette for a world in a chapter: 'heads'/'tails' in Chapter 1, then 'heads2', 'heads3'... */
export const palette = (lv: Level, w: W) => `${w ? 'tails' : 'heads'}${['', '', '2', '3', '4', '5'][Math.min(chapter(lv), 5)]}`;
const chapter = (lv: Level) => Number(lv.id.split('-')[0]);
/** Background set per chapter (Chapter 1 'surface', Chapter 2 'roots', Chapter 3 'stone', Chapter 4 'waters', Chapter 5 'dark'). */
const BG = ['', 'surface', 'roots', 'stone', 'waters', 'dark'];

/** Loads every texture the board needs once. Rejects if `npm run art` hasn't been run. */
export async function loadArt(): Promise<Art> {
  const keys = Object.keys(await loadManifest()).filter((k) => /^(tiles|ui|bg|chars\/tarnish)\//.test(k));
  const tex = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await texture(k)] as const)));
  const [sol, lune] = await Promise.all([loadPuppet('sol'), loadPuppet('lune')]);
  sol.partnerSide = 1;
  lune.partnerSide = -1;
  return { tex, sol, lune };
}

/** Same floor variant every time for a given cell; plain stone about half the time. */
function floorVariant(id: string, w: W, i: number): number {
  let h = 2166136261;
  for (const c of `${id}:${w}:${i}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = (h >>> 0) % 8;
  return r < 4 ? 1 : (r % 3) + 2;
}

/** N=1, E=2, S=4, W=8 neighbours that are walls; off-board counts as wall. */
function wallMask(lv: Level, tiles: string, i: number): number {
  const x = i % lv.w, y = Math.floor(i / lv.w);
  const wall = (dx: number, dy: number) => {
    const nx = x + dx, ny = y + dy;
    return nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h || tiles[ny * lv.w + nx] === '#';
  };
  return (wall(0, -1) ? 1 : 0) | (wall(1, 0) ? 2 : 0) | (wall(0, 1) ? 4 : 0) | (wall(-1, 0) ? 8 : 0);
}

/** A 64-px-based asset scaled to tile size `t`. (Pixi reads `@2x` and sizes those textures in 1x units.) */
export function sprite(art: Art, key: string, x: number, y: number, t: number): Sprite {
  const s = new Sprite(art.tex[key]);
  s.scale.set(t / 64);
  s.position.set(x, y);
  return s;
}

/**
 * Terrain sprites for one world. Returns the cells the greybox still has to draw on top
 * (plates, gates, seesaws), since Chapter 2 art isn't made yet.
 */
export function drawTerrain(art: Art, layer: Container, lv: Level, terrain: State, w: W, cell: (w: W, i: number) => [number, number], t: number) {
  const p = palette(lv, w), lit = /[=-]/.test(terrain.tiles[w]) ? light(lv, terrain)[w] : null;
  for (let i = 0; i < lv.w * lv.h; i++) {
    const [x, y] = cell(w, i), c = terrain.tiles[w][i];
    if (c === '#') { layer.addChild(sprite(art, `tiles/wall-${wallMask(lv, terrain.tiles[w], i)}.${p}`, x, y, t)); continue; }
    if (lit && (c === '=' || c === '-')) {
      // A bridge stands as solid light/shadow, or is a cleft with a faint ghost of the bridge in it.
      const bridge = sprite(art, `tiles/${c === '=' ? 'mirage' : 'shadow-bridge'}.${p}`, x, y, t);
      if (voidBridge(c, lit[i])) { layer.addChild(sprite(art, `tiles/chasm.${p}`, x, y, t)); bridge.alpha = 0.16; }
      layer.addChild(bridge);
      continue;
    }
    if (c === '~' || c === '_' || c === '+') {
      layer.addChild(sprite(art, `tiles/${c === '~' ? 'water' : c === '_' ? 'basin-dry' : 'raft'}.${p}`, x, y, t));
      continue;
    }
    layer.addChild(sprite(art, `tiles/floor-${floorVariant(lv.id, w, i)}.${p}`, x, y, t));
    if (c === '&') {
      // Open while something stands on it (RULES.md §8): the gate slides back and the water runs.
      const open = terrain.pos[w] === i || terrain.objs[w][i] !== ' ';
      layer.addChild(sprite(art, `tiles/sluice-${open ? 'open' : 'closed'}.${p}`, x, y, t));
      continue;
    }
    const ALTAR: Record<string, string> = { O: 'altar-weight', Q: 'altar-light', '(': 'altar-weight-used', ')': 'altar-light-used', '%': 'cracked' };
    if (ALTAR[c]) { layer.addChild(sprite(art, `tiles/${ALTAR[c]}.${p}`, x, y, t)); continue; }
    const key = c === '^' ? 'pit' : c === ',' ? 'pit-crate' : c === ';' ? 'pit-tarnish' : c === 'G' ? (w ? 'goal-tails' : 'goal-heads') : null;
    if (key) layer.addChild(sprite(art, `tiles/${key}.${p}`, x, y, t));
  }
}

/** An actor (crate / lantern / Tarnish) whose sprite has its feet at `feetY`; z-sorted by it. */
export function actor(art: Art, key: string, cx: number, feetY: number, t: number, scale = 1, alpha = 1): Sprite {
  const s = new Sprite(art.tex[key]);
  const crate = key.startsWith('tiles/');
  s.anchor.set(0.5, crate ? 58 / 64 : 88 / 96);
  s.scale.set((t / 64) * scale);
  s.position.set(cx, feetY);
  s.alpha = alpha;
  s.zIndex = feetY;
  return s;
}

/** Background layers scaled to cover the window, with a little parallax toward `focus`. */
export function drawBackground(art: Art, layer: Container, vw: number, vh: number, focusX: number, chapterNo = 1) {
  const set = BG[Math.min(chapterNo, BG.length - 1)] || 'surface';
  const k = Math.max(vw / 1280, vh / 720) * 1.03;
  ['far', 'mid', 'near'].forEach((name, depth) => {
    const s = new Sprite(art.tex[`bg/${set}-${name}`] ?? art.tex[`bg/surface-${name}`]);
    s.scale.set(k);
    s.anchor.set(0.5);
    s.position.set(vw / 2 - (focusX - vw / 2) * 0.01 * depth, vh / 2);
    layer.addChild(s);
  });
}

/** The reeded coin rim between the worlds. */
export function drawSeam(art: Art, layer: Container, landscape: boolean, x: number, y: number, w: number, h: number) {
  const tx = art.tex[landscape ? 'ui/seam-v' : 'ui/seam-h'];
  // The band is 24 texture units thick; scale maps that onto the band.
  const k = (landscape ? w : h) / 24;
  const s = new TilingSprite({ texture: tx, width: w / k, height: h / k });
  s.scale.set(k);
  s.position.set(x, y);
  layer.addChild(s);
}
