// Chapter 2 mechanisms, drawn as one physical idea (playtest feedback: the links must be visible):
// every plate, door and balance stone hangs on a rope that runs over a pulley in the seam.
// Press a plate and its rope hoists your door and drops the one across the seam; shove a raised
// stone down and its twin is yanked up. Rules live in the engine; this only shows them.
import { Container, Graphics, Sprite } from 'pixi.js';
import { isGate, isPlate } from '../engine/parse';
import { gateJammed, gateOpen, linkActive, occupied } from '../engine/tick';
import type { Level, State, W } from '../engine/types';
import { palette, type Art } from './sprites';
import { ease, type Particles, type Tweens } from './tween';

interface Geometry {
  t: number;
  landscape: boolean;
  halfAt(w: W): [number, number];
  cell(i: number): [number, number];
}

/** One rope over one pulley: a plate letter's plates and doors, or a pair of balance stones. */
interface Rope { key: string; members: { w: W; i: number }[]; pulley: Sprite; anchor: number }

export interface DoorChange { w: W; i: number; opened: boolean; byPartner: boolean }

const ROPE = 0x8a6a3a;
const SEAM = 0.4; // seam thickness in tiles (same as the board's)

export class Mechanisms {
  private sprites = new Map<string, Sprite>();
  private ropes: Rope[] = [];
  private lines: [Graphics, Graphics] = [new Graphics(), new Graphics()];
  private glyphOf = new Map<string, number>();

  constructor(
    private art: Art, private lv: Level, private g: Geometry,
    private overlay: [Container, Container], private seam: Container,
    private fx: Particles, private tweens: Tweens,
  ) {
    // Link glyphs in order of first appearance, so links never depend on colour (SPEC §5.2).
    for (const c of lv.start.tiles[0] + lv.start.tiles[1]) {
      const l = c.toLowerCase();
      if ((isPlate(c) || isGate(c)) && !this.glyphOf.has(l)) this.glyphOf.set(l, (this.glyphOf.size % 6) + 1);
    }
  }

  get any() { return this.glyphOf.size > 0 || this.lv.start.tiles[0].includes('/') || this.lv.start.tiles[0].includes('|'); }

  private texFor(s: State, w: W, i: number): string | null {
    const c = s.tiles[w][i], p = palette(this.lv, w);
    if (isPlate(c)) return `tiles/plate-${occupied(s, w, i) ? 'down' : 'up'}.${p}`;
    if (isGate(c)) return `tiles/gate-${gateOpen(this.lv, s, w, i) ? 'open' : 'closed'}.${p}`;
    if (c === '|') return `tiles/stone-up.${p}`;
    if (c === '/') return `tiles/stone-down.${p}`;
    return null;
  }

  private ring(w: W, i: number): [number, number] {
    const [x, y] = this.g.cell(i);
    return [x + this.g.t / 2, y + this.g.t * 0.14];
  }

  /** Where a rope leaves this half toward its pulley (half-local). */
  private edge(w: W, anchor: number): [number, number] {
    const { t, landscape } = this.g, { lv } = this;
    return landscape ? [w ? 0 : lv.w * t, anchor] : [anchor, w ? 0 : lv.h * t];
  }

  /** Board-space point of a half-local point. */
  private board(w: W, [x, y]: [number, number]): [number, number] {
    const [ox, oy] = this.g.halfAt(w);
    return [ox + x, oy + y];
  }

  build(s: State) {
    const { t, landscape } = this.g, { lv } = this;
    this.sprites.clear();
    this.ropes = [];
    this.seam.children.filter((c) => c.label === 'pulley').forEach((c) => c.destroy());
    // The board clears its overlay layers before a build, so the rope graphics are recreated here.
    this.lines = [new Graphics(), new Graphics()];
    this.lines.forEach((l, w) => this.overlay[w].addChild(l));

    // Mechanism sprites and their glyphs.
    for (const w of [0, 1] as W[]) for (let i = 0; i < lv.w * lv.h; i++) {
      const key = this.texFor(s, w, i);
      if (!key) continue;
      const [x, y] = this.g.cell(i);
      const sp = new Sprite(this.art.tex[key]);
      sp.scale.set(t / 64);
      sp.position.set(x, y);
      this.overlay[w].addChild(sp);
      this.sprites.set(`${w}:${i}`, sp);
      const l = s.tiles[w][i].toLowerCase();
      const n = this.glyphOf.get(l);
      if (n) {
        // A child of the tile sprite, so it's in the tile's own 64-unit space.
        const gl = new Sprite(this.art.tex[`ui/glyph-${n}`]);
        gl.anchor.set(0.5);
        gl.scale.set(0.7);
        gl.position.set(32, isPlate(s.tiles[w][i]) ? 32 : 9);
        sp.addChild(gl);
      }
    }

    // Ropes: one per link letter, one per balance-stone pair.
    const groups = new Map<string, { w: W; i: number }[]>();
    for (const w of [0, 1] as W[]) for (let i = 0; i < lv.w * lv.h; i++) {
      const c = s.tiles[w][i];
      const key = isPlate(c) || isGate(c) ? `link:${c.toLowerCase()}` : c === '/' || c === '|' ? `stone:${i}` : null;
      if (key) (groups.get(key) ?? groups.set(key, []).get(key)!).push({ w, i });
    }
    for (const [key, members] of groups) {
      const along = members.map(({ w, i }) => this.ring(w, i)[landscape ? 1 : 0]);
      const anchor = along.reduce((a, b) => a + b, 0) / along.length;
      const pulley = new Sprite(this.art.tex['ui/pulley']);
      pulley.label = 'pulley';
      pulley.anchor.set(0.5);
      pulley.scale.set((t * 0.36) / 32);
      const seamMid = landscape ? (lv.w + SEAM / 2) * t : (lv.h + SEAM / 2) * t;
      pulley.position.set(...(landscape ? [seamMid, anchor] : [anchor, seamMid]) as [number, number]);
      this.seam.addChild(pulley);
      this.ropes.push({ key, members, pulley, anchor });
    }
    this.drawRopes();
  }

  /** Ropes sag a little between the ring and the seam; drawn under the actors. */
  private drawRopes() {
    const { t } = this.g;
    this.lines.forEach((l) => l.clear());
    for (const r of this.ropes) for (const { w, i } of r.members) {
      const [ax, ay] = this.ring(w, i), [bx, by] = this.edge(w, r.anchor);
      const mx = (ax + bx) / 2, my = (ay + by) / 2 + t * 0.18;
      const l = this.lines[w];
      l.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by).stroke({ width: Math.max(2.5, t * 0.05), color: 0x2a1e14, alpha: 0.55 });
      l.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by).stroke({ width: Math.max(1.5, t * 0.028), color: ROPE, alpha: 0.95 });
    }
  }

  /** Animate prev -> next. Returns door changes so the board can make the characters react. */
  update(prev: State, next: State): DoorChange[] {
    const { t } = this.g, { lv } = this, doors: DoorChange[] = [];
    for (const r of this.ropes) {
      const link = r.key.startsWith('link:') ? r.key.slice(5) : null;
      const moved = link
        ? linkActive(lv, prev, link) !== linkActive(lv, next, link)
        : r.members.some(({ w, i }) => prev.tiles[w][i] !== next.tiles[w][i]);
      if (!moved) continue;
      // The pulley turns and a glint runs from the cause (plates / the stone pushed down) to the effects.
      const turn = (link ? linkActive(lv, next, link) : true) ? 1 : -1, r0 = r.pulley.rotation;
      this.tweens.add(0.45, (k) => (r.pulley.rotation = r0 + turn * Math.PI * k), { ease: ease.outBack });
      const causes = r.members.filter(({ w, i }) => (link ? isPlate(next.tiles[w][i]) : next.tiles[w][i] === '/'));
      const effects = r.members.filter((m) => !causes.includes(m));
      for (const c of causes) for (const e of effects) this.glint(c, e, r);
    }
    for (const [key, sp] of this.sprites) {
      const [ws, is] = key.split(':'), w = Number(ws) as W, i = Number(is);
      const before = this.texFor(prev, w, i)!, after = this.texFor(next, w, i)!;
      const c = next.tiles[w][i];
      if (isGate(c) && gateJammed(lv, next, w, i) && !gateJammed(lv, prev, w, i)) this.jam(w, i, sp);
      if (before === after) continue;
      sp.texture = this.art.tex[after];
      const y0 = sp.y;
      if (after.includes('closed') || after.includes('stone-up')) {
        // Drops (door) or pops up (stone) with a little bounce and dust.
        const from = after.includes('closed') ? -t * 0.22 : t * 0.2;
        this.tweens.add(0.22, (k) => (sp.y = y0 + from * (1 - k)), { ease: ease.outBack });
        this.dust(w, i, 5);
      } else if (!after.includes('plate')) {
        this.tweens.add(0.18, (k) => (sp.scale.y = (t / 64) * (0.88 + 0.12 * k)), { ease: ease.outQuad });
      }
      if (isGate(c)) doors.push({ w, i, opened: after.includes('open'), byPartner: lv.owner[c.toLowerCase()] !== w });
    }
    return doors;
  }

  private glint(from: { w: W; i: number }, to: { w: W; i: number }, r: Rope) {
    const { t } = this.g;
    const a = this.board(from.w, this.ring(from.w, from.i));
    const b = this.board(from.w, this.edge(from.w, r.anchor));
    const c = this.board(to.w, this.edge(to.w, r.anchor));
    const d = this.board(to.w, this.ring(to.w, to.i));
    const dot = new Graphics().circle(0, 0, t * 0.09).fill({ color: 0xfff4d6, alpha: 0.95 }).circle(0, 0, t * 0.18).fill({ color: 0xfff4d6, alpha: 0.3 });
    this.fx.addChild(dot);
    const path = [a, b, c, d];
    this.tweens.add(0.42, (k) => {
      const seg = Math.min(2, Math.floor(k * 3)), u = k * 3 - seg;
      const [p, q] = [path[seg], path[seg + 1]];
      dot.position.set(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u);
      dot.alpha = k < 0.9 ? 1 : (1 - k) * 10;
    }).then(() => dot.destroy());
  }

  private jam(w: W, i: number, sp: Sprite) {
    const { t } = this.g, x0 = sp.x;
    const [cx, cy] = this.board(w, [this.g.cell(i)[0] + t / 2, this.g.cell(i)[1] + t * 0.2]);
    this.fx.burst(cx, cy, { n: 10, color: 0xffd27a, size: t * 0.03, speed: t * 2.2, up: t * 0.5, grav: t * 8, life: 0.35 });
    this.tweens.add(0.3, (k) => (sp.x = x0 + Math.sin(k * 40) * t * 0.03 * (1 - k)));
  }

  private dust(w: W, i: number, n: number) {
    const { t } = this.g, [x, y] = this.g.cell(i);
    const [cx, cy] = this.board(w, [x + t / 2, y + t * 0.85]);
    this.fx.burst(cx, cy, { n, color: 0xc99a55, size: t * 0.04, speed: t * 0.8, spread: Math.PI * 0.9, life: 0.35, alpha: 0.6 });
  }
}
