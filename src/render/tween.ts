// Minimal tweens + particles for the board's juice (SPEC.md §5.6).
import { Container, Graphics } from 'pixi.js';

export const ease = {
  linear: (k: number) => k,
  outQuad: (k: number) => 1 - (1 - k) * (1 - k),
  inQuad: (k: number) => k * k,
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  /** Overshoots a little then settles: the step feel. */
  outBack: (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
};

interface Tween { t: number; dur: number; delay: number; ease: (k: number) => number; update: (k: number) => void; done?: () => void }

export class Tweens {
  private list: Tween[] = [];
  /** Animate `update(easedProgress)` over `dur` seconds. Resolves when done. */
  add(dur: number, update: (k: number) => void, opts: { ease?: (k: number) => number; delay?: number } = {}): Promise<void> {
    return new Promise((done) => this.list.push({ t: 0, dur: Math.max(dur, 1e-4), delay: opts.delay ?? 0, ease: opts.ease ?? ease.outQuad, update, done }));
  }
  wait(sec: number) { return this.add(sec, () => {}); }
  update(dt: number) {
    for (const tw of [...this.list]) {
      if (tw.delay > 0) { tw.delay -= dt; continue; }
      tw.t = Math.min(tw.dur, tw.t + dt);
      const k = tw.t / tw.dur;
      tw.update(tw.ease(k));
      if (k >= 1) { this.list.splice(this.list.indexOf(tw), 1); tw.done?.(); }
    }
  }
  /** Jump every tween to its end (undo/restart/level load must never wait on animation). */
  finish() { for (const tw of this.list.splice(0)) { tw.update(1); tw.done?.(); } }
  get busy() { return this.list.length > 0; }
}

interface P { g: Graphics; vx: number; vy: number; life: number; max: number; grav: number; shrink: boolean }

/** Small dots that fly, fall and fade: dust, sparks, glints. */
export class Particles extends Container {
  private ps: P[] = [];
  burst(x: number, y: number, o: { n: number; color: number; size: number; speed: number; up?: number; life?: number; grav?: number; spread?: number; alpha?: number }) {
    for (let i = 0; i < o.n; i++) {
      const a = (o.spread ?? Math.PI * 2) * (Math.random() - 0.5) - Math.PI / 2;
      const sp = o.speed * (0.4 + Math.random() * 0.6);
      const g = new Graphics().circle(0, 0, o.size * (0.6 + Math.random() * 0.6)).fill({ color: o.color, alpha: o.alpha ?? 0.8 });
      g.position.set(x + (Math.random() - 0.5) * o.size * 2, y);
      this.addChild(g);
      const life = (o.life ?? 0.45) * (0.7 + Math.random() * 0.6);
      this.ps.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 0), life, max: life, grav: o.grav ?? 0, shrink: true });
    }
  }
  update(dt: number) {
    for (const p of [...this.ps]) {
      p.life -= dt;
      if (p.life <= 0) { p.g.destroy(); this.ps.splice(this.ps.indexOf(p), 1); continue; }
      p.vy += p.grav * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      const k = p.life / p.max;
      p.g.alpha = k;
      if (p.shrink) p.g.scale.set(0.5 + 0.5 * k);
    }
  }
  clearAll() { for (const p of this.ps.splice(0)) p.g.destroy(); }
}
