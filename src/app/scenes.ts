// Tiny scene manager: one scene at a time, plus optional overlays (pause, settings) on top.
import { Container, Graphics, type Application } from 'pixi.js';
import type { Action } from './settings';

export interface Scene {
  root: Container;
  enter?(): void;
  exit?(): void;
  update?(dt: number): void;
  resize?(w: number, h: number): void;
  /** Return true if the action was used (overlays get first pick). */
  onAction?(a: Action): boolean | void;
}

export class Scenes {
  private stack: Scene[] = [];
  private fade = new Graphics();

  constructor(private app: Application) {
    app.ticker.add((t) => this.stack.forEach((s) => s.update?.(t.deltaMS / 1000)));
    window.addEventListener('resize', () => this.resize());
  }

  get top(): Scene | undefined { return this.stack[this.stack.length - 1]; }

  /** Replace everything with `s`, with a short fade through the night colour. */
  show(s: Scene, fade = true) {
    for (const old of this.stack.splice(0)) this.drop(old);
    this.push(s);
    if (fade) this.flash();
  }

  push(s: Scene) {
    this.stack.push(s);
    this.app.stage.addChild(s.root);
    this.app.stage.addChild(this.fade);
    s.resize?.(window.innerWidth, window.innerHeight);
    s.enter?.();
  }

  pop() {
    const s = this.stack.pop();
    if (s) this.drop(s);
  }

  action(a: Action) {
    for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i].onAction?.(a)) return;
  }

  private drop(s: Scene) {
    s.exit?.();
    s.root.removeFromParent();
    s.root.destroy({ children: true });
  }

  private resize() {
    for (const s of this.stack) s.resize?.(window.innerWidth, window.innerHeight);
  }

  private flash() {
    const f = this.fade;
    f.clear().rect(0, 0, window.innerWidth, window.innerHeight).fill(0x0e1028);
    f.alpha = 1;
    const tick = (t: { deltaMS: number }) => {
      f.alpha -= t.deltaMS / 280;
      if (f.alpha <= 0) { f.alpha = 0; this.app.ticker.remove(tick); }
    };
    this.app.ticker.add(tick);
  }
}
