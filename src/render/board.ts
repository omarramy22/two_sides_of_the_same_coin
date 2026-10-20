// The game board: both worlds, the seam and everything on them. Sprites persist; the board only
// animates the difference between two engine States (SPEC.md §8 hard rule). No game rules here.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { isGate, isPlate } from '../engine/parse';
import { gateJammed, gateOpen } from '../engine/tick';
import type { Dir, GameEvent, Level, State, W } from '../engine/types';
import type { Puppet } from './rig';
import { actor, drawSeam, drawTerrain, type Art } from './sprites';
import { ease, Particles, Tweens } from './tween';

const SEAM = 0.4;
const STEP = 0.12; // SPEC §5.6: ~120 ms, ease-out-back
const DUST = [0xc99a55, 0x4a5a8c];

export interface BoardOpts { reducedMotion: boolean; highContrast: boolean }

class Half extends Container {
  tiles = new Container();
  overlay = new Container();
  actors = new Container();
  constructor() {
    super();
    this.actors.sortableChildren = true;
    this.addChild(this.tiles, this.overlay, this.actors);
  }
}

export class Board extends Container {
  t = 64;
  landscape = true;
  readonly tweens = new Tweens();
  /** Shaken as a whole on heavy events. */
  private inner = new Container();
  private halves: [Half, Half] = [new Half(), new Half()];
  private seam = new Container();
  private glow = new Graphics();
  private ghosts = new Container();
  private fx = new Particles();
  private crates = new Map<string, Sprite>();
  private foes = new Map<string, Sprite>();
  private shakeT = 0;
  private clock = 0;
  readonly puppets: [Puppet, Puppet];
  private mechanisms: boolean;

  constructor(private art: Art, readonly lv: Level, public state: State, public opts: BoardOpts) {
    super();
    this.puppets = [art.sol, art.lune];
    this.mechanisms = [...lv.start.tiles.join('')].some((c) => isPlate(c) || isGate(c) || c === '/' || c === '|');
    this.inner.addChild(this.seam, ...this.halves, this.glow, this.ghosts, this.fx);
    this.addChild(this.inner);
  }

  /** Size in px for tile size `t` in the given orientation. */
  static size(lv: Level, t: number, landscape: boolean): [number, number] {
    return landscape ? [(lv.w * 2 + SEAM) * t, lv.h * t] : [lv.w * t, (lv.h * 2 + SEAM) * t];
  }

  /** Largest tile size (px) that fits a w×h area. */
  static fit(lv: Level, w: number, h: number): { t: number; landscape: boolean } {
    const landscape = w >= h;
    const [cw, ch] = Board.size(lv, 1, landscape);
    return { t: Math.max(16, Math.floor(Math.min(w / cw, h / ch))), landscape };
  }

  /** Lay out at tile size `t`; the board's pivot is its centre (for the coin flip). */
  layout(t: number, landscape: boolean) {
    this.t = t;
    this.landscape = landscape;
    const [w, h] = Board.size(this.lv, t, landscape);
    this.pivot.set(w / 2, h / 2);
    this.halves.forEach((half, k) => half.position.set(...this.halfAt(k as W)));
    this.rebuild(this.state);
  }

  halfAt(w: W): [number, number] {
    const { lv, t } = this;
    return this.landscape ? [w * (lv.w + SEAM) * t, 0] : [0, w * (lv.h + SEAM) * t];
  }
  /** Top-left of a cell, in the half's local space. */
  private cell = (i: number): [number, number] => [(i % this.lv.w) * this.t, Math.floor(i / this.lv.w) * this.t];
  /** Feet position of an actor standing on cell i (half-local). */
  private feet(i: number): [number, number] {
    const [x, y] = this.cell(i);
    return [x + this.t / 2, y + this.t * 0.8];
  }
  /** Board-space centre of a cell. */
  centre(w: W, i: number): [number, number] {
    const [ox, oy] = this.halfAt(w), [x, y] = this.cell(i);
    return [ox + x + this.t / 2, oy + y + this.t / 2];
  }

  /** Redraw everything for `s` with no animation (load, undo, restart, resize). */
  rebuild(s: State) {
    this.tweens.finish();
    this.state = s;
    this.puppets.forEach((p) => { p.removeFromParent(); p.alpha = 1; p.scale.set(this.t / 64); p.walking = false; });
    this.crates.clear();
    this.foes.clear();
    for (const w of [0, 1] as W[]) {
      const half = this.halves[w];
      half.actors.removeChildren().forEach((c) => c.destroy());
      for (let i = 0; i < s.objs[w].length; i++) {
        const o = s.objs[w][i];
        if (o === 'C') this.addCrate(w, i);
        else if (o === '@' || o === '?') this.addFoe(w, i, o === '@');
      }
      const p = this.puppets[w];
      p.position.set(...this.feet(s.pos[w]));
      p.zIndex = p.y;
      p.alpha = s.fallen[w] ? 0.35 : 1;
      half.actors.addChild(p);
    }
    this.refreshTerrain(s);
    this.seam.removeChildren().forEach((c) => c.destroy());
    const { lv, t } = this;
    if (this.landscape) drawSeam(this.art, this.seam, true, lv.w * t, 0, SEAM * t, lv.h * t);
    else drawSeam(this.art, this.seam, false, 0, lv.h * t, lv.w * t, SEAM * t);
    this.updateMoods();
  }

  private addCrate(w: W, i: number) {
    const s = actor(this.art, 'tiles/crate', ...this.feet(i), this.t);
    this.halves[w].actors.addChild(s);
    this.crates.set(`${w}:${i}`, s);
  }
  private addFoe(w: W, i: number, awake: boolean) {
    const s = actor(this.art, `chars/tarnish/${awake ? 'awake' : 'asleep'}`, ...this.feet(i), this.t);
    this.halves[w].actors.addChild(s);
    this.foes.set(`${w}:${i}`, s);
  }

  /** Tiles, plus the Chapter 2 objects that still use simple shapes until their art exists. */
  private refreshTerrain(s: State) {
    for (const w of [0, 1] as W[]) {
      const half = this.halves[w];
      half.tiles.removeChildren().forEach((c) => c.destroy());
      drawTerrain(this.art, half.tiles, this.lv, s, w, (_w, i) => this.cell(i), this.t);
      half.overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.drawMechanisms(half.overlay, s, w);
    }
  }

  private drawMechanisms(layer: Container, s: State, w: W) {
    const { t, lv } = this, g = new Graphics();
    layer.addChild(g);
    const label = (c: string, x: number, y: number) => {
      const txt = new Text({ text: c, style: { fill: w ? 0xe8f0ff : 0x2a1e14, fontSize: Math.round(t * 0.38), fontFamily: 'Georgia, serif', fontWeight: 'bold' } });
      txt.anchor.set(0.5);
      txt.position.set(x + t / 2, y + t / 2);
      layer.addChild(txt);
    };
    for (let i = 0; i < lv.w * lv.h; i++) {
      const c = s.tiles[w][i], [x, y] = this.cell(i), cx = x + t / 2;
      if (isPlate(c)) {
        g.roundRect(x + t * 0.2, y + t * 0.2, t * 0.6, t * 0.6, t * 0.08).fill(0x9c8cd4).stroke({ width: 2, color: 0x2a1e14 });
        label(c, x, y);
      } else if (isGate(c)) {
        if (gateOpen(lv, s, w, i)) {
          const jam = gateJammed(lv, s, w, i);
          g.rect(x + 3, y + 3, t - 6, t - 6).stroke({ width: jam ? 5 : 2, color: jam ? 0xe07a6b : 0x4a5a8c });
        } else g.rect(x, y, t, t).fill(0x4a5a8c).stroke({ width: 2, color: 0x2a1e14 });
        label(c, x, y);
      } else if (c === '/' || c === '|') {
        const up = c === '|', py = y + t * (up ? 0.22 : 0.36), ph = t * (up ? 0.38 : 0.28), pw = t * (up ? 0.86 : 0.8);
        if (up) g.roundRect(cx - pw / 2, py + t * 0.12, pw, ph, 4).fill({ color: 0x000000, alpha: 0.3 });
        g.poly([cx, py + ph - 1, cx - t * 0.08, py + ph + t * 0.12, cx + t * 0.08, py + ph + t * 0.12]).fill(0x2a1e14);
        g.roundRect(cx - pw / 2, py, pw, ph, 4).fill(up ? 0xc08850 : 0xa0703c).stroke({ width: 2, color: 0x2a1e14 });
      }
    }
  }

  /**
   * Animate prev -> next from the tick's events. Resolves when the motion is done
   * (the scene doesn't wait on it for input; it calls `tweens.finish()` if needed).
   */
  animate(prev: State, next: State, ev: GameEvent[], dir: Dir): Promise<void> {
    this.tweens.finish();
    this.state = next;
    const { t } = this, jobs: Promise<void>[] = [];
    const has = (type: GameEvent['type'], w: W) => ev.some((e) => e.type === type && e.world === w);

    for (const w of [0, 1] as W[]) {
      const p = this.puppets[w];
      if (dir === 'left' || dir === 'right') p.facing = dir === 'left' ? -1 : 1;
      if (next.pos[w] !== prev.pos[w]) {
        const [fx, fy] = this.feet(prev.pos[w]), [tx, ty] = this.feet(next.pos[w]);
        p.walking = true;
        this.dust(w, fx, fy, 4);
        jobs.push(this.tweens.add(STEP, (k) => { p.position.set(fx + (tx - fx) * k, fy + (ty - fy) * k); p.zIndex = p.y; }, { ease: ease.outBack })
          .then(() => { p.walking = false; }));
      } else if (has('bump', w) || has('stomp', w) || has('stompJam', w)) {
        p.bump();
        this.puppets[1 - w].lookAtPartner(1);
      }
    }

    // Crates: slide (with a scrape trail) or drop into a pit.
    for (const e of ev) {
      if ((e.type !== 'push' && e.type !== 'fill') || e.from === undefined) continue;
      const key = `${e.world}:${e.from}`, s = this.crates.get(key);
      if (!s) continue;
      this.crates.delete(key);
      const [fx, fy] = this.feet(e.from), [tx, ty] = this.feet(e.at);
      const [ox, oy] = this.halfAt(e.world);
      this.particlesAlong(e.world, fx, fy, tx, ty);
      if (e.type === 'push') {
        this.crates.set(`${e.world}:${e.at}`, s);
        jobs.push(this.tweens.add(STEP, (k) => { s.position.set(fx + (tx - fx) * k, fy + (ty - fy) * k); s.zIndex = s.y; }, { ease: ease.outBack }));
      } else {
        const base = s.scale.x;
        jobs.push(this.tweens.add(STEP, (k) => s.position.set(fx + (tx - fx) * k, fy + (ty - fy) * k))
          .then(() => this.tweens.add(0.16, (k) => { s.scale.set(base * (1 - 0.45 * k)); s.y = ty + t * 0.12 * k; s.alpha = 1 - k; }, { ease: ease.inQuad }))
          .then(() => {
            s.destroy();
            this.refreshTerrain(this.state);
            this.shake(0.22);
            this.fx.burst(ox + tx, oy + ty - t * 0.25, { n: 10, color: DUST[e.world], size: t * 0.05, speed: t * 1.6, up: t * 0.6, grav: t * 6, life: 0.5 });
          }));
      }
    }

    // The Tarnish move after the characters (RULES.md §5a): a short hop, or a tumble into a pit.
    for (const e of ev) {
      if ((e.type !== 'foeStep' && e.type !== 'foeFall') || e.from === undefined) continue;
      const key = `${e.world}:${e.from}`, s = this.foes.get(key);
      if (!s) continue;
      this.foes.delete(key);
      const [fx, fy] = this.feet(e.from), [tx, ty] = this.feet(e.at), base = s.scale.x;
      const hop = this.tweens.add(0.15, (k) => { s.position.set(fx + (tx - fx) * k, fy + (ty - fy) * k - Math.sin(k * Math.PI) * t * 0.14); s.zIndex = s.y; }, { delay: 0.05 });
      if (e.type === 'foeStep') { this.foes.set(`${e.world}:${e.at}`, s); jobs.push(hop); continue; }
      const [ox, oy] = this.halfAt(e.world);
      jobs.push(hop
        .then(() => this.tweens.add(0.3, (k) => { s.scale.set(base * (1 - 0.6 * k)); s.rotation = k * 1.6; s.y = ty + t * 0.2 * k; s.alpha = 1 - k; }, { ease: ease.inQuad }))
        .then(() => {
          s.destroy();
          this.refreshTerrain(this.state);
          this.shake(0.18);
          this.fx.burst(ox + tx, oy + ty - t * 0.25, { n: 8, color: 0xb5543a, size: t * 0.045, speed: t * 1.4, up: t * 0.5, grav: t * 6 });
        }));
    }

    const flips = ev.filter((e) => e.type === 'flip');
    if (flips.length) jobs.push(this.flipFoes(flips, next));

    // Falls (ease-in, SPEC §5.6) and catches.
    for (const w of [0, 1] as W[]) {
      if (!next.fallen[w]) continue;
      const p = this.puppets[w], caught = has('caught', w), base = p.scale.x;
      jobs.push(this.tweens.wait(STEP).then(() => caught
        ? this.tweens.add(0.35, (k) => { p.x += Math.sin(k * 40) * t * 0.03; p.alpha = 1 - 0.65 * k; p.tint = k < 0.5 ? 0xff9a8a : 0xffffff; })
        : this.tweens.add(0.38, (k) => { p.scale.set(base * (1 - 0.7 * k)); p.y += t * 0.012; p.alpha = 1 - 0.8 * k; }, { ease: ease.inQuad })));
      this.shake(0.15);
    }

    // Terrain follows once the movers arrive. Fills redraw it themselves when they land; gates
    // depend on who stands where, so levels with mechanisms redraw every move.
    const changed = next.tiles[0] !== prev.tiles[0] || next.tiles[1] !== prev.tiles[1];
    if ((changed || this.mechanisms) && !ev.some((e) => e.type === 'fill' || e.type === 'foeFall')) {
      jobs.push(this.tweens.wait(STEP).then(() => this.refreshTerrain(this.state)));
    }
    this.updateMoods();
    return Promise.all(jobs).then(() => {});
  }

  /** The halves line up: a light pulse runs along the seam and every Tarnish flips. */
  private flipFoes(flips: GameEvent[], next: State): Promise<void> {
    const { t } = this;
    const [ax, ay] = this.centre(0, next.pos[0]), [bx, by] = this.centre(1, next.pos[1]);
    const beam = new Graphics();
    this.ghosts.addChild(beam);
    const pulse = this.tweens.add(0.6, (k) => {
      beam.clear()
        .moveTo(ax, ay).lineTo(bx, by).stroke({ width: t * (0.3 - 0.2 * k), color: 0xfff4d6, alpha: 0.85 * (1 - k) })
        .circle(ax, ay, t * (0.3 + k)).fill({ color: 0xfff4d6, alpha: 0.5 * (1 - k) })
        .circle(bx, by, t * (0.3 + k)).fill({ color: 0xfff4d6, alpha: 0.5 * (1 - k) });
    }).then(() => beam.destroy());
    const swaps = flips.map((e, n) => {
      const key = `${e.world}:${e.at}`, s = this.foes.get(key);
      if (!s) return Promise.resolve();
      const awake = next.objs[e.world][e.at] === '@', base = s.scale.y, [ox, oy] = this.halfAt(e.world), [fx, fy] = this.feet(e.at);
      return this.tweens.add(0.14, (k) => (s.scale.y = base * (1 - 0.75 * k)), { delay: 0.1 + n * 0.04, ease: ease.inQuad })
        .then(() => {
          s.texture = this.art.tex[`chars/tarnish/${awake ? 'awake' : 'asleep'}`];
          this.fx.burst(ox + fx, oy + fy - t * 0.4, { n: 12, color: 0xfff4d6, size: t * 0.035, speed: t * 1.8, life: 0.5 });
          return this.tweens.add(0.22, (k) => (s.scale.y = base * (0.25 + 0.75 * k)), { ease: ease.outBack });
        });
    });
    return Promise.all([pulse, ...swaps]).then(() => {});
  }

  /** Who is waiting, who is celebrating (SPEC §5.3 personality). */
  private updateMoods() {
    const s = this.state, on = [0, 1].map((w) => s.tiles[w][s.pos[w]] === 'G' && !s.fallen[w]);
    this.puppets.forEach((p, w) => (p.mood = on[0] && on[1] ? 'celebrate' : on[w] ? 'sad' : 'idle'));
  }

  private dust(w: W, x: number, y: number, n: number) {
    if (this.opts.reducedMotion) return;
    const [ox, oy] = this.halfAt(w);
    this.fx.burst(ox + x, oy + y - this.t * 0.04, { n, color: DUST[w], size: this.t * 0.04, speed: this.t * 0.7, spread: Math.PI * 0.9, life: 0.35, alpha: 0.6 });
  }

  private particlesAlong(w: W, x0: number, y0: number, x1: number, y1: number) {
    if (this.opts.reducedMotion) return;
    for (let k = 0; k <= 4; k++) this.dust(w, x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * k / 4, 2);
  }

  /** Subtle screen shake on heavy events; off with reduced motion (SPEC §5.6). */
  shake(sec: number) { if (!this.opts.reducedMotion) this.shakeT = Math.max(this.shakeT, sec); }

  /** Hint tier 3: ghost footprints for the next few states (numbered). */
  showGhosts(path: State[]) {
    this.ghosts.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { t } = this;
    let prev = this.state;
    path.forEach((s, n) => {
      for (const w of [0, 1] as W[]) {
        if (s.pos[w] === prev.pos[w]) continue;
        const [cx, cy] = this.centre(w, s.pos[w]);
        const g = new Graphics()
          .ellipse(cx - t * 0.1, cy + t * 0.12, t * 0.07, t * 0.11).fill({ color: 0xfff4d6, alpha: 0.55 })
          .ellipse(cx + t * 0.1, cy + t * 0.02, t * 0.07, t * 0.11).fill({ color: 0xfff4d6, alpha: 0.55 });
        const num = new Text({ text: String(n + 1), style: { fill: 0xfff4d6, fontSize: Math.round(t * 0.3), fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x0e1028, width: 3 } } });
        num.anchor.set(0.5);
        num.position.set(cx, cy - t * 0.22);
        this.ghosts.addChild(g, num);
      }
      prev = s;
    });
    this.ghosts.alpha = 1;
    this.tweens.add(0.6, (k) => (this.ghosts.alpha = 1 - k), { delay: 3.4 });
  }

  /** Level complete: both halves slide toward the seam (the coin closing). */
  close(): Promise<void> {
    const d = this.t * SEAM * 0.5 + this.t * 0.15;
    const [a, b] = this.halves, [ax, ay] = [a.x, a.y], [bx, by] = [b.x, b.y];
    return this.tweens.add(0.45, (k) => {
      if (this.landscape) { a.x = ax + d * k; b.x = bx - d * k; } else { a.y = ay + d * k; b.y = by - d * k; }
    }, { ease: ease.inQuad });
  }

  update(dt: number) {
    this.clock += dt;
    this.tweens.update(dt);
    this.fx.update(dt);
    this.puppets.forEach((p) => p.update(dt));
    this.shakeT = Math.max(0, this.shakeT - dt);
    const m = this.shakeT > 0 ? this.t * 0.06 * (this.shakeT / 0.22) : 0;
    this.inner.position.set((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    this.drawAlignment();
  }

  /** High-contrast mode (SPEC §7): a bold ring at every actor's feet; coral = awake Tarnish. */
  private drawOutlines(g: Graphics) {
    const { t } = this;
    const ring = (w: W, x: number, y: number, color: number) => {
      const [ox, oy] = this.halfAt(w);
      g.ellipse(ox + x, oy + y, t * 0.36, t * 0.14).stroke({ width: Math.max(2, t * 0.05), color, alpha: 0.95 });
    };
    this.puppets.forEach((p, w) => ring(w as W, p.x, p.y, 0xffffff));
    for (const [key, s] of this.foes) {
      const w = Number(key[0]) as W;
      ring(w, s.x, s.y, s.texture === this.art.tex['chars/tarnish/awake'] ? 0xff6a5a : 0x9a9a9a);
    }
    for (const [key, s] of this.crates) ring(Number(key[0]) as W, s.x, s.y, 0xffe08a);
  }

  /** Pendants glow and a thread of light crosses the seam while the halves line up (SPEC §2.4). */
  private drawAlignment() {
    const g = this.glow.clear(), s = this.state, { t, lv } = this;
    if (this.opts.highContrast) this.drawOutlines(g);
    if (s.pos[0] !== s.pos[1] || s.fallen[0] || s.fallen[1]) return;
    const pulse = 0.75 + 0.25 * Math.sin(this.clock * 3);
    const pend = (w: W): [number, number] => {
      const p = this.puppets[w], [ox, oy] = this.halfAt(w);
      return [ox + p.x, oy + p.y - t * 0.33];
    };
    const [a, b] = [pend(0), pend(1)];
    for (const [x, y] of [a, b]) g.circle(x, y, t * 0.26).fill({ color: 0xfff4d6, alpha: 0.25 * pulse }).circle(x, y, t * 0.09).fill({ color: 0xfff4d6, alpha: 0.65 * pulse });
    const [s0, s1]: [number, number][] = this.landscape
      ? [[(lv.w - 0.2) * t, a[1]], [(lv.w + SEAM + 0.2) * t, b[1]]]
      : [[a[0], (lv.h - 0.2) * t], [b[0], (lv.h + SEAM + 0.2) * t]];
    g.moveTo(...s0).lineTo(...s1).stroke({ width: t * 0.16, color: 0xfff4d6, alpha: 0.3 * pulse })
      .moveTo(...s0).lineTo(...s1).stroke({ width: t * 0.05, color: 0xffffff, alpha: 0.9 * pulse });
  }
}
