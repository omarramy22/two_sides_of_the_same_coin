// Wordless story scenes (SPEC §2, §7): the opening intro, a three-panel vignette after each
// chapter, and the ending on the Rim. Panels are built in code from the game's own art (puppets,
// chapter backgrounds, the Tarnish) plus paper-cut silhouettes, so they add no image files.
// Any key or tap skips.
import { Container, FillGradient, Graphics, Sprite, Text } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import { audio } from '../audio/audio';
import { loadPuppet, type Puppet } from '../render/rig';
import { ease, Particles, Tweens } from '../render/tween';
import { FONT } from './style';

export type Story = { kind: 'intro' } | { kind: 'vignette'; chapter: number } | { kind: 'ending' };

const VW = 960, VH = 540;
const BG = ['', 'surface', 'roots', 'stone', 'waters', 'dark', 'rim'];
const INK = 0x14101e, FIG = 0x2a2448, GOLD = 0xe8b66a, GOLD_L = 0xfff4d6, SILVER = 0xc9d3e6, SILVER_L = 0xe8f0ff;

interface Kit { layer: Container; tw: Tweens; fx: Particles; sol: Puppet; lune: Puppet; ctx: Ctx }
interface Shot { dur: number; make(k: Kit): void }

// ---------- drawing helpers (virtual 960x540 space) ----------

/** The scene at the top of the well: moonlit (or dawn) sky, a hill, the well, the two people. */
function surface(turn: number, dawn = false): Container {
  const c = new Container();
  c.addChild(dawn ? sky(0x6a5e80, 0xf6d58e, false) : sky(0x101430, 0x8a9ac8));
  if (!dawn) c.addChild(new Graphics().circle(780, 110, 38).fill({ color: 0xe8f0ff, alpha: 0.9 }).circle(766, 100, 34).fill({ color: 0x1c2046, alpha: 0.15 }));
  c.addChild(new Graphics().moveTo(0, 430).quadraticCurveTo(VW / 2, 360, VW, 430).lineTo(VW, VH).lineTo(0, VH).closePath().fill(dawn ? 0x5e4418 : 0x141828));
  const fig = people(0, 0, turn);
  fig.scale.set(1.5);
  fig.position.set(VW / 2, 420);
  c.addChild(fig, well(VW / 2, 330)); // the well in front: at the end they stand behind it, together
  return c;
}

function sky(top: number, bottom: number, stars = true): Container {
  const c = new Container();
  const grad = new FillGradient(0, 0, 0, VH);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  c.addChild(new Graphics().rect(0, 0, VW, VH).fill(grad));
  if (stars) {
    const g = new Graphics();
    for (let i = 0; i < 70; i++) {
      const x = (i * 137.5) % VW, y = (i * 61.3) % (VH * 0.55);
      g.circle(x, y, 0.8 + ((i * 7) % 3) * 0.5).fill({ color: 0xfff4d6, alpha: 0.35 + ((i * 13) % 5) * 0.1 });
    }
    c.addChild(g);
  }
  return c;
}

/** A chapter background layer, scaled to cover the panel. */
function backdrop(k: Kit, chapter: number, layer: 'far' | 'mid' = 'far'): Sprite {
  const s = new Sprite(k.ctx.art.tex[`bg/${BG[chapter]}-${layer}`] ?? k.ctx.art.tex['bg/surface-far']);
  s.scale.set(Math.max(VW / s.texture.width, VH / s.texture.height));
  return s;
}

/** The stone well seen from the side, mouth at (x, y). */
function well(x: number, y: number): Graphics {
  const g = new Graphics();
  g.roundRect(x - 120, y, 240, 130, 10).fill(0x5b4a3a).stroke({ width: 3, color: INK });
  for (let r = 0; r < 4; r++) for (let b = 0; b < 5; b++) {
    const bx = x - 120 + b * 48 + (r % 2) * 24;
    g.rect(Math.max(x - 120, bx), y + 8 + r * 30, 44, 26).stroke({ width: 1.5, color: 0x2e241a, alpha: 0.8 });
  }
  g.ellipse(x, y, 128, 22).fill(0x7a6650).stroke({ width: 3, color: INK });
  g.ellipse(x, y + 2, 104, 14).fill(0x05060f);
  return g;
}

/**
 * Two paper-cut figures at the well. turn 0: back to back, facing away. turn 1: side by side,
 * facing each other, hands joined. In between they drift closer and turn.
 */
function people(x: number, y: number, turn: number): Graphics {
  const g = new Graphics(), d = 175 - 105 * turn, toward = turn >= 0.5;
  const figure = (fx: number, faceRight: boolean, tall: number, hood: boolean) => {
    const f = faceRight ? 1 : -1;
    g.moveTo(fx - 26, y).lineTo(fx - 18, y - 70 * tall).quadraticCurveTo(fx, y - 84 * tall, fx + 18, y - 70 * tall).lineTo(fx + 26, y).closePath()
      .fill(FIG).stroke({ width: 2, color: 0x4a4070 });
    const hy = y - 96 * tall, rim = faceRight ? GOLD : SILVER;
    g.circle(fx, hy, 17).fill(FIG).stroke({ width: 1.5, color: 0x4a4070 });
    g.moveTo(fx + f * 15, hy - 2).lineTo(fx + f * 22, hy + 3).lineTo(fx + f * 15, hy + 6).fill(FIG); // nose
    if (hood) g.moveTo(fx - 16, hy - 4).quadraticCurveTo(fx - f * 6, hy - 34, fx + f * 16, hy - 12).quadraticCurveTo(fx, hy - 16, fx - 16, hy - 4).fill(FIG);
    else g.moveTo(fx - 18, hy - 8).lineTo(fx - 4, hy - 22).lineTo(fx + 14, hy - 12).fill(FIG); // a cap's brim
    // rim light from the moon (or the dawn)
    g.moveTo(fx + f * 18, y - 70 * tall).lineTo(fx + f * 26, y).stroke({ width: 3, color: rim, alpha: 0.9 });
    g.arc(fx, hy, 18, faceRight ? -1.2 : Math.PI + 1.2, faceRight ? 0.6 : Math.PI - 0.6, !faceRight).stroke({ width: 3, color: rim, alpha: 0.9 });
  };
  figure(x - d, toward, 1, false);
  figure(x + d, !toward, 0.94, true);
  if (turn >= 0.95) g.moveTo(x - d + 22, y - 44).quadraticCurveTo(x, y - 30, x + d - 22, y - 44).stroke({ width: 6, color: INK });
  return g;
}

/** A whole coin (reeded edge), or one half of it: side -1 = the gold Heads half, +1 = silver Tails. */
function coin(r: number, side: -1 | 0 | 1 = 0): Graphics {
  const g = new Graphics();
  const half = (s: -1 | 1) => {
    g.moveTo(0, -r).arc(0, 0, r, -Math.PI / 2, Math.PI / 2, s < 0).closePath().fill(s < 0 ? GOLD : SILVER).stroke({ width: 2, color: INK });
    g.moveTo(0, -r * 0.7).arc(0, 0, r * 0.7, -Math.PI / 2, Math.PI / 2, s < 0).stroke({ width: 1.2, color: s < 0 ? 0xa8742a : 0x7f8bb0 });
  };
  if (side <= 0) half(-1);
  if (side >= 0) half(1);
  g.circle(0, 0, r).stroke({ width: 2, color: INK, alpha: side ? 0 : 1 });
  return g;
}

function puppetAt(k: Kit, p: Puppet, x: number, y: number, scale: number, facing: 1 | -1) {
  p.removeFromParent();
  p.position.set(x, y);
  p.scale.set(scale);
  p.facing = facing;
  p.alpha = 1;
  p.mood = 'idle';
  p.walking = false;
  k.layer.addChild(p);
}

const twinkle = (k: Kit, x: number, y: number, color = GOLD_L, n = 16) =>
  k.fx.burst(x, y, { n, color, size: 3, speed: 140, life: 0.7 });

// ---------- shots ----------

const intro: Shot[] = [
  { // The wish: two people at the well, back to back; a coin goes in.
    dur: 5.2, make(k) {
      k.layer.addChild(surface(0));
      const c = coin(14);
      c.position.set(VW / 2 - 262, 250);
      k.layer.addChild(c);
      k.tw.add(1.6, (t) => {
        c.position.set(VW / 2 - 262 + 262 * t, 250 - Math.sin(t * Math.PI) * 170 + 80 * t);
        c.scale.x = Math.cos(t * 18);
      }, { delay: 0.8, ease: ease.linear }).then(() => {
        k.tw.add(0.5, (t) => { c.y = 330 + 10 * t; c.alpha = 1 - t; }, { ease: ease.inQuad });
        twinkle(k, VW / 2, 332);
      });
    },
  },
  { // The fall: down through every layer of the well; the coin splits in two.
    dur: 5.6, make(k) {
      const strip = new Container();
      for (let ch = 1; ch <= 5; ch++) {
        const b = backdrop(k, ch);
        b.y = (ch - 1) * VH;
        strip.addChild(b);
      }
      k.layer.addChild(strip);
      k.tw.add(4.2, (t) => (strip.y = -t * 4 * VH), { ease: ease.inOutSine });
      const heads = coin(30, -1), tails = coin(30, 1);
      for (const h of [heads, tails]) { h.position.set(VW / 2, VH / 2); k.layer.addChild(h); }
      k.tw.add(3.4, (t) => { heads.scale.x = tails.scale.x = Math.abs(Math.cos(t * 14)) * 0.9 + 0.1; });
      k.tw.wait(3.4).then(() => {
        heads.scale.x = tails.scale.x = 1;
        twinkle(k, VW / 2, VH / 2, 0xffffff, 26);
        k.tw.add(1.4, (t) => { heads.x = VW / 2 - 140 * t; tails.x = VW / 2 + 140 * t; heads.rotation = -0.4 * t; tails.rotation = 0.4 * t; }, { ease: ease.outQuad });
      });
    },
  },
  { // Two worlds: Sol wakes in the gold half, Lune in the silver one, the seam between them.
    dur: 5.6, make(k) {
      // The same well wall seen from each face of the coin: warm day on the left, cool night on the right.
      const day = backdrop(k, 1), night = backdrop(k, 1);
      day.tint = 0xffd9a0;
      night.tint = 0x7f8bd0;
      night.mask = new Graphics().rect(VW / 2, 0, VW / 2, VH).fill(0xffffff);
      k.layer.addChild(day, night, night.mask as Graphics, new Graphics().rect(VW / 2 - 8, 0, 16, VH).fill(0xc9a04e).stroke({ width: 2, color: INK }));
      puppetAt(k, k.sol, VW / 4, 380, 2.4, 1);
      puppetAt(k, k.lune, (VW * 3) / 4, 380, 2.4, -1);
      for (const p of [k.sol, k.lune]) { p.alpha = 0; k.tw.add(1, (t) => (p.alpha = t), { delay: 0.4 }); }
      k.tw.wait(1.8).then(() => { k.sol.bump(); k.lune.bump(); twinkle(k, VW / 4, 290); twinkle(k, (VW * 3) / 4, 290, SILVER_L); });
      k.tw.wait(3).then(() => { k.sol.lookAtPartner(2.5); k.lune.lookAtPartner(2.5); });
    },
  },
  { // Below: in the dark, the Tarnish open their eyes.
    dur: 4.6, make(k) {
      k.layer.addChild(new Graphics().rect(0, 0, VW, VH).fill(0x030208));
      const eyes = new Graphics();
      k.layer.addChild(eyes);
      const pairs = [[220, 300], [480, 380], [720, 280], [600, 200], [330, 440]];
      k.tw.add(4.4, (t) => {
        eyes.clear();
        pairs.forEach(([x, y], i) => {
          const open = Math.min(1, Math.max(0, t * 5 - i * 0.7)) * (Math.sin(t * 9 + i) > -0.85 ? 1 : 0.1);
          for (const dx of [-12, 12]) eyes.ellipse(x + dx, y, 6, 5 * open).fill({ color: 0xffe08a, alpha: 0.9 * open });
        });
      }, { ease: ease.linear });
      const foe = new Sprite(k.ctx.art.tex['chars/tarnish/awake']);
      foe.anchor.set(0.5);
      foe.scale.set(2.2);
      foe.position.set(VW / 2, VH / 2 + 40);
      foe.alpha = 0;
      k.layer.addChild(foe);
      k.tw.add(1.2, (t) => (foe.alpha = 0.85 * t), { delay: 2.6 });
    },
  },
];

function vignette(n: number): Shot[] {
  return [
    { // The two halves cleared this layer: they look at each other across the seam.
      dur: 3.8, make(k) {
        k.layer.addChild(backdrop(k, n), new Graphics().rect(VW / 2 - 6, 0, 12, VH).fill({ color: 0xc9a04e, alpha: 0.9 }));
        puppetAt(k, k.sol, VW / 2 - 150, 400, 2.2, 1);
        puppetAt(k, k.lune, VW / 2 + 150, 400, 2.2, -1);
        k.sol.mood = k.lune.mood = 'celebrate';
        k.tw.wait(1.8).then(() => { k.sol.mood = k.lune.mood = 'idle'; k.sol.lookAtPartner(2); k.lune.lookAtPartner(2); });
      },
    },
    { // Deeper: the halves fall into the next layer, a little closer each time.
      dur: 3.8, make(k) {
        const a = backdrop(k, n), b = backdrop(k, n + 1);
        b.y = VH;
        k.layer.addChild(a, b);
        k.tw.add(3.4, (t) => { a.y = -t * VH; b.y = VH - t * VH; }, { ease: ease.inOutSine });
        const gap = 260 - (n / 6) * 220;
        const heads = coin(26, -1), tails = coin(26, 1);
        heads.position.set(VW / 2 - gap / 2, VH / 2);
        tails.position.set(VW / 2 + gap / 2, VH / 2);
        k.layer.addChild(heads, tails);
        k.tw.add(3.6, (t) => { heads.y = tails.y = VH / 2 + Math.sin(t * 6) * 8; heads.rotation = -0.2 + 0.1 * Math.sin(t * 4); tails.rotation = -heads.rotation; }, { ease: ease.linear });
      },
    },
    { // Up at the surface the two at the well turn, a little more each chapter.
      dur: 4, make(k) {
        const before = surface((n - 1) / 6), after = surface(n / 6);
        after.alpha = 0;
        k.layer.addChild(before, after);
        k.tw.add(1.6, (t) => { before.alpha = 1 - t; after.alpha = t; }, { delay: 1.2 });
      },
    },
  ];
}

const ending: Shot[] = [
  { // The Rim: the halves fold together onto one shared floor and the two walk to each other.
    dur: 7.2, make(k) {
      k.layer.addChild(backdrop(k, 6), new Graphics().rect(0, 400, VW / 2, 60).fill(0xe8cf96).rect(VW / 2, 400, VW / 2, 60).fill(0xb8c2d8)
        .rect(0, 398, VW, 4).fill(INK));
      puppetAt(k, k.sol, 140, 420, 2.2, 1);
      puppetAt(k, k.lune, VW - 140, 420, 2.2, -1);
      k.sol.walking = k.lune.walking = true;
      k.tw.add(3.2, (t) => { k.sol.x = 140 + (VW / 2 - 190) * t; k.lune.x = VW - 140 - (VW / 2 - 190) * t; }, { delay: 0.5, ease: ease.linear })
        .then(() => {
          k.sol.walking = k.lune.walking = false;
          k.sol.mood = k.lune.mood = 'celebrate';
          const whole = coin(30);
          whole.position.set(VW / 2, 250);
          whole.scale.set(0.2);
          k.layer.addChild(whole);
          twinkle(k, VW / 2, 250, 0xffffff, 40);
          audio.sfx('levelComplete');
          k.tw.add(0.8, (t) => whole.scale.set(0.2 + 0.8 * t), { ease: ease.outBack });
        });
    },
  },
  { // The Tarnish shine back into ordinary coins: the wish is granted.
    dur: 4.4, make(k) {
      k.layer.addChild(new Graphics().rect(0, 0, VW, VH).fill(0x1c1730));
      [[200, 260], [380, 360], [560, 240], [740, 340], [470, 160]].forEach(([x, y], i) => {
        const foe = new Sprite(k.ctx.art.tex['chars/tarnish/asleep']);
        foe.anchor.set(0.5);
        foe.scale.set(1.4);
        foe.position.set(x, y);
        const c = coin(22);
        c.position.set(x, y);
        c.alpha = 0;
        k.layer.addChild(foe, c);
        k.tw.wait(0.8 + i * 0.45).then(() => {
          twinkle(k, x, y, GOLD_L, 18);
          k.tw.add(0.4, (t) => { foe.alpha = 1 - t; c.alpha = t; c.scale.set(0.6 + 0.4 * t); });
          k.tw.add(1.2, (t) => (c.rotation = Math.sin(t * 6) * 0.15), { delay: 0.4, ease: ease.linear });
        });
      });
    },
  },
  { // The whole coin rises back up through every layer.
    dur: 4.6, make(k) {
      const strip = new Container();
      for (let ch = 6; ch >= 1; ch--) {
        const b = backdrop(k, ch);
        b.y = -(6 - ch) * VH;
        strip.addChild(b);
      }
      k.layer.addChild(strip);
      k.tw.add(4.2, (t) => (strip.y = t * 5 * VH), { ease: ease.inOutSine });
      const c = coin(34);
      c.position.set(VW / 2, VH / 2);
      k.layer.addChild(c);
      k.tw.add(4.4, (t) => (c.scale.x = Math.cos(t * 10)), { ease: ease.linear });
    },
  },
  { // Dawn at the well: the two who made the wish, side by side.
    dur: 6.5, make(k) {
      const sun = new Graphics().circle(VW / 2, 150, 60).fill({ color: 0xfff4d6, alpha: 0.7 });
      const scene = surface(1, true);
      scene.addChildAt(sun, 1);
      k.layer.addChild(scene);
      const c = coin(16);
      c.position.set(VW / 2, 300);
      k.layer.addChild(c);
      twinkle(k, VW / 2, 300, GOLD_L, 24);
      k.tw.add(6, (t) => { c.y = 300 - 30 * Math.sin(t * Math.PI); sun.y = -50 * t; }, { ease: ease.linear });
    },
  },
];

const SHOTS = (s: Story): Shot[] => (s.kind === 'intro' ? intro : s.kind === 'ending' ? ending : vignette(s.chapter));

/** Plays a story, then calls `done` (also on skip). */
export function createStory(ctx: Ctx, story: Story, done: () => void): Scene {
  const root = new Container(), stage = new Container(), frame = new Graphics(), layers = new Container();
  const tw = new Tweens(), fx = new Particles();
  stage.addChild(layers, fx);
  const skip = new Text({ text: 'any key to skip', style: { fontFamily: FONT, fontSize: 16, fill: 0xc9d3e6 } });
  skip.alpha = 0.7;
  root.addChild(stage, frame, skip);
  root.eventMode = 'static';
  root.on('pointertap', () => finish());

  let finished = false, kit: Kit | null = null, shot = 0, clock = 0;
  const finish = () => { if (!finished) { finished = true; done(); } };
  const shots = SHOTS(story);

  const play = () => {
    if (finished || !kit) return;
    if (shot >= shots.length) { finish(); return; }
    const layer = new Container();
    layer.alpha = 0;
    // Each panel is clipped to the frame.
    layer.mask = new Graphics().rect(0, 0, VW, VH).fill(0xffffff);
    layer.addChild(layer.mask as Graphics);
    layers.addChild(layer);
    const old = layers.children.filter((c) => c !== layer);
    shots[shot].make({ ...kit, layer });
    tw.add(0.5, (t) => { layer.alpha = t; old.forEach((o) => (o.alpha = 1 - t)); }).then(() => old.forEach((o) => {
      for (const p of [kit!.sol, kit!.lune]) if (p.parent === o) p.removeFromParent();
      o.destroy({ children: true });
    }));
    tw.wait(shots[shot].dur).then(() => { shot++; play(); });
  };

  Promise.all([loadPuppet('sol'), loadPuppet('lune')]).then(([sol, lune]) => {
    sol.partnerSide = 1;
    lune.partnerSide = -1;
    kit = { layer: layers, tw, fx, sol, lune, ctx };
    play();
  }).catch(finish);

  const layout = (w: number, h: number) => {
    const k = Math.min(w / (VW + 40), h / (VH + 40));
    stage.scale.set(k);
    stage.position.set((w - VW * k) / 2, (h - VH * k) / 2);
    // A storybook frame: dark page, gold rule, reeded inner edge.
    frame.clear()
      .rect(0, 0, w, h).fill(0x0e1028).rect(stage.x, stage.y, VW * k, VH * k).cut()
      .rect(stage.x - 6, stage.y - 6, VW * k + 12, VH * k + 12).stroke({ width: 3, color: GOLD })
      .rect(stage.x - 12, stage.y - 12, VW * k + 24, VH * k + 24).stroke({ width: 1, color: GOLD, alpha: 0.5 });
    skip.position.set(w - skip.width - 20, h - skip.height - 12);
  };

  return {
    root,
    enter() { layout(window.innerWidth, window.innerHeight); },
    resize: layout,
    update(dt) {
      clock += dt;
      tw.update(dt);
      fx.update(dt);
      kit?.sol.update(dt);
      kit?.lune.update(dt);
      skip.alpha = clock < 3 ? 0.7 : Math.max(0, 0.7 - (clock - 3));
    },
    onAction() { finish(); return true; },
  };
}
