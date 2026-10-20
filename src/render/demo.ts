// `?demo`: the Phase 2 character demo. Sol and Lune idle on the left, walk back and forth on the right.
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { loadPuppet, texture } from './rig';

export async function startDemo(app: Application) {
  const T = 128; // tile size for the demo
  const stage = new Container();
  app.stage.addChild(stage);
  const floors = [0xebc985, 0x2e3570];
  floors.forEach((c, i) => stage.addChild(new Graphics().rect(0, i * 260, 1400, 260).fill(c)));

  const label = (s: string, x: number, y: number, fill: number) => {
    const t = new Text({ text: s, style: { fill, fontSize: 18, fontFamily: 'sans-serif' } });
    t.position.set(x, y);
    stage.addChild(t);
  };

  const scale = T / 64;
  const idle = [await loadPuppet('sol'), await loadPuppet('lune')];
  const walk = [await loadPuppet('sol'), await loadPuppet('lune')];
  idle.forEach((p, i) => { p.scale.set(scale); p.position.set(160, 200 + i * 260); p.partnerSide = i ? -1 : 1; stage.addChild(p); });
  walk.forEach((p, i) => { p.scale.set(scale); p.position.set(520, 200 + i * 260); stage.addChild(p); });
  const foes = await Promise.all(['chars/tarnish/awake', 'chars/tarnish/asleep'].map(texture));
  foes.forEach((tx, i) => {
    const s = new Sprite(tx);
    s.scale.set(scale / 2);
    s.anchor.set(0.5, 88 / 96);
    s.position.set(1100 + i * 170, 200 + 260);
    stage.addChild(s);
  });
  label('idle (breathing, blinking, glancing at the seam)', 40, 20, 0x2a1e14);
  label('walk (one tile every 0.6 s)', 440, 20, 0x2a1e14);
  label('the Tarnish: awake / asleep', 1040, 280, 0xe8f0ff);

  let clock = 0;
  app.ticker.add((tk) => {
    const dt = tk.deltaMS / 1000;
    clock += dt;
    idle.forEach((p) => p.update(dt));
    // Step one tile, pause, step again; turn around at the ends of a 4-tile run.
    const cycle = clock % 0.6, leg = Math.floor(clock / 0.6) % 8;
    const dir = leg < 4 ? 1 : -1, steps = leg < 4 ? leg : 8 - leg;
    const progress = Math.min(1, cycle / 0.18);
    walk.forEach((p) => {
      p.walking = progress < 1;
      p.facing = dir;
      p.x = 520 + T * 0.75 * (steps + dir * progress);
      p.update(dt);
    });
  });
}
