// Wordless story scenes (SPEC §2, §7): the opening intro, a three-panel vignette after each
// chapter, and the ending. Painted key art (art/src/story: skies, hills, the well, the two
// wishers) is staged with a camera, parallax, particles and sound cues; the rest comes from the
// game's own art (puppets, tiles, chapter colours, the Tarnish, the logo). Any key or tap skips.
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import { audio } from '../audio/audio';
import { loadPuppet, type Puppet } from '../render/rig';
import { ease, Particles, Tweens } from '../render/tween';
import { C, text } from './style';

export type Story = { kind: 'intro' } | { kind: 'vignette'; chapter: number } | { kind: 'ending' };

const VW = 960, VH = 540;
const INK = 0x14101e, GOLD = 0xe8b66a, GOLD_L = 0xfff4d6, SILVER = 0xc9d3e6, SILVER_L = 0xe8f0ff;
/** Floor colours of each chapter's layer, top to bottom of the well (Heads, Tails). */
const LAYERS: [number, number][] = [[0xebc985, 0x4a5a8c], [0xcdbb82, 0x33506a], [0xc9b79c, 0x525a80], [0xb9c9a8, 0x3e6080], [0x64503e, 0x352d58], [0xe8cf96, 0xb8c2d8]];

interface Kit {
  /** The shot's own camera: zoom and pan it, add things to it. */
  cam: Container;
  /** Fixed on top of the camera (flashes, vignette, words). */
  over: Container;
  tw: Tweens; fx: Particles; sol: Puppet; lune: Puppet; ctx: Ctx;
  /** Called every frame while this shot is on screen. */
  tick(fn: (dt: number, t: number) => void): void;
  shake(sec: number): void;
}
interface Shot { dur: number; make(k: Kit): void }

// ---------- building blocks (virtual 960x540 space) ----------

function art(k: Kit, key: string, x: number, y: number, scale = 0.5, ax = 0.5, ay = 1): Sprite {
  const s = new Sprite(k.ctx.art.tex[key]);
  s.anchor.set(ax, ay);
  s.scale.set(scale);
  s.position.set(x, y);
  return s;
}

/** Full-panel painted layer (1280x720 art), slightly oversized so the camera can move. */
function layer(k: Kit, key: string, tint = 0xffffff): Sprite {
  const s = art(k, key, VW / 2, VH / 2, (VW / 1280) * 1.12, 0.5, 0.5);
  s.tint = tint;
  return s;
}

/** Drifting fireflies (or dawn pollen) that pulse softly. */
function fireflies(k: Kit, n: number, color: number, area = { x: 0, y: 220, w: VW, h: 300 }) {
  const g = new Graphics();
  k.cam.addChild(g);
  const seeds = [...Array(n)].map((_, i) => ({ x: area.x + ((i * 173) % area.w), y: area.y + ((i * 97) % area.h), p: i * 1.7 }));
  k.tick((_, t) => {
    g.clear();
    for (const s of seeds) {
      const x = s.x + Math.sin(t * 0.5 + s.p) * 18, y = s.y + Math.cos(t * 0.4 + s.p * 1.3) * 12, a = 0.35 + 0.35 * Math.sin(t * 2 + s.p);
      g.circle(x, y, 5).fill({ color, alpha: a * 0.25 }).circle(x, y, 1.8).fill({ color, alpha: a });
    }
  });
}

/** Dark edges, so the eye goes to the middle (stacked translucent bands: a cheap gradient). */
function vignetteOverlay(): Graphics {
  const g = new Graphics();
  for (let i = 0; i < 12; i++) {
    const a = 0.07 * (1 - i / 12), dy = i * 11, dx = i * 15;
    g.rect(0, dy, VW, 11).fill({ color: 0x050612, alpha: a }).rect(0, VH - dy - 11, VW, 11).fill({ color: 0x050612, alpha: a })
      .rect(dx, 0, 15, VH).fill({ color: 0x050612, alpha: a }).rect(VW - dx - 15, 0, 15, VH).fill({ color: 0x050612, alpha: a });
  }
  return g;
}

/**
 * The well at the top of the story, with the two who made the wish. turn 0: back to back, facing
 * away from each other. turn 1: face to face, close together.
 */
function wellScene(k: Kit, turn: number, dawn = false) {
  const sky = layer(k, dawn ? 'story/dawn-sky' : 'story/night-sky');
  const hills = layer(k, 'story/hills', dawn ? 0xd8a070 : 0xffffff);
  const well = art(k, 'story/well', VW / 2, 470, 0.5);
  const d = 230 - 120 * turn, face = turn >= 0.5 ? 1 : -1;
  const sun = art(k, 'story/wisher-sun', VW / 2 - d, 478, 0.5), moon = art(k, 'story/wisher-moon', VW / 2 + d, 478, 0.5);
  sun.scale.x = 0.5 * face; // the art faces right
  moon.scale.x = -0.5 * face;
  if (dawn) for (const s of [sun, moon, well]) s.tint = 0xffe2c0;
  k.cam.addChild(sky, hills, sun, moon, well);
  return { sky, hills, well, sun, moon };
}

/** A coin, whole (side 0) or one half: -1 the gold Heads half, +1 the silver Tails half. */
function coin(r: number, side: -1 | 0 | 1 = 0): Graphics {
  const g = new Graphics();
  for (const s of [-1, 1] as const) {
    if (side && side !== s) continue;
    g.moveTo(0, -r).arc(0, 0, r, -Math.PI / 2, Math.PI / 2, s < 0).closePath().fill(s < 0 ? GOLD : SILVER).stroke({ width: 2, color: INK });
    g.moveTo(0, -r * 0.7).arc(0, 0, r * 0.7, -Math.PI / 2, Math.PI / 2, s < 0).stroke({ width: 1.4, color: s < 0 ? 0xa8742a : 0x7f8bb0 });
  }
  if (!side) g.circle(0, 0, r).stroke({ width: 2, color: INK }).circle(0, 0, r + 2).stroke({ width: 1, color: GOLD_L, alpha: 0.6 });
  return g;
}

/** A soft glow behind something bright. */
const glow = (r: number, color: number, a = 0.35) =>
  new Graphics().circle(0, 0, r).fill({ color, alpha: a * 0.4 }).circle(0, 0, r * 0.55).fill({ color, alpha: a });

/**
 * The well shaft seen from inside: rings of stone rushing past, coloured by the layer you're in.
 * dir +1 falls (rings grow out of the middle), -1 rises (rings shrink into it).
 */
function tunnel(k: Kit, dir: 1 | -1, dur: number) {
  const g = new Graphics();
  k.cam.addChild(new Graphics().rect(0, 0, VW, VH).fill(0x05060f), g);
  let z0 = 0;
  k.tick((dt, t) => {
    const speed = 0.5 + 1.6 * Math.sin(Math.min(1, t / dur) * Math.PI);
    z0 = (((z0 - dt * speed * dir) % 1) + 1) % 1;
    const depth = Math.max(0, Math.min(5.99, (dir > 0 ? t / dur : 1 - t / dur) * 6)), [hc, tc] = LAYERS[Math.floor(depth)];
    g.clear();
    for (let i = 14; i >= 0; i--) {
      const z = (i + z0) / 14, r = 30 / Math.max(0.04, z), a = Math.min(1, z * 1.6);
      if (r > 900) continue;
      // Each ring has two halves: the Heads wall on the left, the Tails wall on the right.
      g.moveTo(VW / 2, VH / 2 - r).arc(VW / 2, VH / 2, r, -Math.PI / 2, Math.PI / 2, true).stroke({ width: 10 / z, color: hc, alpha: a });
      g.moveTo(VW / 2, VH / 2 - r).arc(VW / 2, VH / 2, r, -Math.PI / 2, Math.PI / 2).stroke({ width: 10 / z, color: tc, alpha: a });
      for (let s = 0; s < 12; s++) {
        const an = (s / 12) * Math.PI * 2 + i;
        g.moveTo(VW / 2 + Math.cos(an) * r * 0.97, VH / 2 + Math.sin(an) * r * 0.97).lineTo(VW / 2 + Math.cos(an) * r * 1.03, VH / 2 + Math.sin(an) * r * 1.03)
          .stroke({ width: 2 / z, color: 0x000000, alpha: a * 0.6 });
      }
    }
  });
}

/** A ground of real game floor tiles for one world (ch = chapter palette). */
function floor(k: Kit, w: 0 | 1, ch: number, x: number, y: number, width: number, height: number): TilingSprite {
  const pal = `${w ? 'tails' : 'heads'}${['', '', '2', '3', '4', '5', '6'][ch]}`;
  const s = new TilingSprite({ texture: k.ctx.art.tex[`tiles/floor-1.${pal}`], width, height });
  s.position.set(x, y);
  s.tileScale.set(0.75);
  return s;
}

/** The reeded seam between the halves, vertical, centred on x. */
function seam(k: Kit, x: number, h = VH): TilingSprite {
  const s = new TilingSprite({ texture: k.ctx.art.tex['ui/seam-v'], width: 24, height: h / 0.75 });
  s.scale.set(0.75);
  s.position.set(x - 9, 0);
  return s;
}

function puppetAt(k: Kit, p: Puppet, x: number, y: number, scale: number, facing: 1 | -1) {
  p.removeFromParent();
  p.position.set(x, y);
  p.scale.set(scale);
  p.facing = facing;
  p.alpha = 1;
  p.mood = 'idle';
  p.walking = false;
  k.cam.addChild(p);
}

const burst = (k: Kit, x: number, y: number, color = GOLD_L, n = 18, speed = 150) =>
  k.fx.burst(x, y, { n, color, size: 3, speed, life: 0.8 });

/** Slow push-in on a point. */
function push(k: Kit, x: number, y: number, from: number, to: number, dur: number, delay = 0) {
  k.cam.pivot.set(x, y);
  k.cam.position.set(x, y);
  k.cam.scale.set(from);
  return k.tw.add(dur, (t) => k.cam.scale.set(from + (to - from) * t), { delay, ease: ease.inOutSine });
}

/** A flash over everything. */
function flash(k: Kit, sec = 0.5, color = 0xffffff) {
  const f = new Graphics().rect(0, 0, VW, VH).fill(color);
  k.over.addChild(f);
  k.tw.add(sec, (t) => (f.alpha = 1 - t), { ease: ease.outQuad }).then(() => f.destroy());
}

/** The thread of light between the two pendants, as when the halves line up in play. */
function thread(k: Kit, ax: number, ay: number, bx: number, by: number, dur: number) {
  const g = new Graphics();
  k.cam.addChild(g);
  k.tick((_, t) => {
    const p = 0.75 + 0.25 * Math.sin(t * 3);
    g.clear().moveTo(ax, ay).lineTo(bx, by).stroke({ width: 10, color: GOLD_L, alpha: 0.3 * p }).moveTo(ax, ay).lineTo(bx, by).stroke({ width: 3, color: 0xffffff, alpha: 0.9 * p })
      .circle(ax, ay, 14).fill({ color: GOLD_L, alpha: 0.5 * p }).circle(bx, by, 14).fill({ color: SILVER_L, alpha: 0.5 * p });
  });
  g.alpha = 0;
  k.tw.add(dur, (t) => (g.alpha = t));
}

// ---------- the intro ----------

const intro: Shot[] = [
  { // The wish. Two people at a well under the moon, back to back. One tosses a coin over the shoulder.
    dur: 7.4, make(k) {
      const s = wellScene(k, 0);
      fireflies(k, 14, 0xd8ff9a);
      k.over.addChild(vignetteOverlay());
      k.tw.add(7, (t) => { s.sky.x = VW / 2 + 20 * t; s.hills.x = VW / 2 + 8 * t; });
      push(k, VW / 2, 330, 1, 1.1, 3.4); // done before the dive, which takes the camera over
      const c = coin(9), g = glow(26, GOLD_L, 0.5);
      const [x0, y0] = [s.sun.x - 88, 352];
      c.position.set(x0, y0);
      g.position.copyFrom(c.position);
      c.alpha = g.alpha = 0;
      k.cam.addChild(g, c);
      k.tw.wait(1.6).then(() => {
        c.alpha = g.alpha = 1;
        audio.sfx('flip');
        burst(k, x0, y0, GOLD_L, 10, 80);
        k.tw.add(1.9, (t) => {
          c.position.set(x0 + (VW / 2 - x0) * t, y0 - Math.sin(t * Math.PI) * 220 + (372 - y0) * t);
          c.scale.x = Math.cos(t * 22);
          g.position.copyFrom(c.position);
          if (Math.random() < 0.5) k.fx.burst(c.x, c.y, { n: 1, color: GOLD_L, size: 2, speed: 20, life: 0.6 });
        }, { ease: ease.linear }).then(() => {
          audio.sfx('fill');
          burst(k, VW / 2, 350, GOLD_L, 24, 120);
          c.alpha = g.alpha = 0;
          // Dive into the dark mouth of the well.
          k.cam.pivot.set(VW / 2, 377); // the dark mouth of the well
          k.cam.position.set(VW / 2, 377);
          const s0 = k.cam.scale.x;
          k.tw.add(1.4, (t) => k.cam.scale.set(s0 + 9 * t * t), { ease: ease.inQuad });
        });
      });
    },
  },
  { // The fall: down through every layer of the well. The coin cracks into two halves.
    dur: 6.4, make(k) {
      tunnel(k, 1, 4.8);
      audio.sfx('water');
      const heads = coin(34, -1), tails = coin(34, 1), g = glow(70, GOLD_L, 0.35);
      for (const h of [g, heads, tails]) { h.position.set(VW / 2, VH / 2); k.cam.addChild(h); }
      k.tw.add(4.2, (t) => { heads.scale.x = tails.scale.x = Math.cos(t * 26); heads.rotation = tails.rotation = Math.sin(t * 3) * 0.3; }, { ease: ease.linear });
      k.tw.wait(4.2).then(() => {
        heads.scale.x = tails.scale.x = 1;
        heads.rotation = tails.rotation = 0;
        audio.sfx('crack');
        audio.sfx('flip');
        flash(k, 0.7);
        k.shake(0.5);
        g.alpha = 0;
        burst(k, VW / 2, VH / 2, 0xffffff, 40, 260);
        k.tw.add(1.8, (t) => {
          heads.position.set(VW / 2 - 360 * t, VH / 2 - 40 * t);
          tails.position.set(VW / 2 + 360 * t, VH / 2 - 40 * t);
          heads.rotation = -1.2 * t;
          tails.rotation = 1.2 * t;
          k.fx.burst(heads.x, heads.y, { n: 1, color: GOLD, size: 3, speed: 30, life: 0.5 });
          k.fx.burst(tails.x, tails.y, { n: 1, color: SILVER_L, size: 3, speed: 30, life: 0.5 });
        }, { ease: ease.outQuad });
      });
    },
  },
  { // Two worlds: a half-coin falls onto each face of the coin, and Sol and Lune wake in its light.
    dur: 7.6, make(k) {
      k.cam.addChild(floor(k, 0, 1, 0, 0, VW / 2, VH), floor(k, 1, 1, VW / 2, 0, VW / 2, VH), seam(k, VW / 2));
      k.over.addChild(vignetteOverlay());
      push(k, VW / 2, VH / 2, 1.08, 1, 7);
      const spots: [Puppet, number, number][] = [[k.sol, VW / 4, GOLD], [k.lune, (VW * 3) / 4, SILVER_L]];
      spots.forEach(([p, x, col], i) => {
        const half = coin(18, i ? 1 : -1), g = glow(40, col, 0.5);
        half.position.set(x, -40);
        g.position.copyFrom(half.position);
        k.cam.addChild(g, half);
        k.tw.add(0.7, (t) => { half.y = g.y = -40 + 390 * t; }, { delay: 0.3 + i * 0.25, ease: ease.inQuad }).then(() => {
          audio.sfx('altar', i as 0 | 1);
          burst(k, x, 350, col, 30, 200);
          k.shake(0.15);
          half.destroy();
          k.tw.add(1.2, (t) => (g.alpha = 1 - t)).then(() => g.destroy());
          puppetAt(k, p, x, 420, 0.01, i ? -1 : 1);
          k.tw.add(0.6, (t) => p.scale.set(0.01 + 2.6 * t), { ease: ease.outBack });
        });
      });
      k.tw.wait(1.6).then(() => audio.playMusic(1));
      k.tw.wait(2.6).then(() => { k.sol.facing = -1; k.lune.facing = 1; }); // looking around...
      k.tw.wait(3.6).then(() => { k.sol.facing = 1; k.lune.facing = -1; k.sol.lookAtPartner(4); k.lune.lookAtPartner(4); }); // ...and across
      k.tw.wait(4.4).then(() => { audio.sfx('align'); thread(k, VW / 4, 330, (VW * 3) / 4, 330, 0.8); });
    },
  },
  { // Below, in the dark under both worlds, the Tarnish open their eyes.
    dur: 5.2, make(k) {
      k.cam.addChild(new Graphics().rect(0, 0, VW, VH).fill(0x030208));
      const eyes = new Graphics(), pairs = [[180, 300], [760, 260], [420, 420], [620, 160], [300, 150], [840, 440]];
      k.cam.addChild(eyes);
      pairs.forEach((_, i) => k.tw.wait(0.4 + i * 0.45).then(() => audio.sfx('foeStep', (i % 2) as 0 | 1)));
      k.tick((_, t) => {
        eyes.clear();
        pairs.forEach(([x, y], i) => {
          const open = Math.min(1, Math.max(0, (t - 0.4 - i * 0.45) * 4)) * (Math.sin(t * 7 + i * 2) > -0.9 ? 1 : 0.15);
          for (const dx of [-11, 11]) eyes.ellipse(x + dx, y, 7, 6 * open).fill({ color: 0xffe08a, alpha: 0.95 * open }).ellipse(x + dx, y, 16, 12 * open).fill({ color: 0xffe08a, alpha: 0.12 * open });
        });
      });
      const foe = art(k, 'chars/tarnish/awake', VW / 2, VH + 220, 3, 0.5, 0.5);
      foe.tint = 0x705050;
      k.cam.addChild(foe);
      k.tw.add(1.6, (t) => (foe.y = VH + 220 - 300 * t), { delay: 3, ease: ease.outQuad });
    },
  },
  { // The title: the two halves find each other and become the coin on the logo.
    dur: 4.6, make(k) {
      k.cam.addChild(layer(k, 'story/night-sky', 0x808cc0));
      const heads = coin(48, -1), tails = coin(48, 1);
      heads.position.set(-80, VH / 2);
      tails.position.set(VW + 80, VH / 2);
      k.cam.addChild(heads, tails);
      const logo = art(k, 'title/logo', VW / 2, VH / 2, 0.55, 0.5, 0.5), back = k.ctx.art.tex['title/logo-back'];
      logo.alpha = 0;
      k.cam.addChild(logo);
      k.tw.add(1.1, (t) => { heads.x = -80 + (VW / 2 + 80) * t; tails.x = VW + 80 - (VW / 2 + 80) * t; }, { ease: ease.inQuad }).then(() => {
        audio.sfx('levelComplete');
        flash(k, 0.6, GOLD_L);
        burst(k, VW / 2, VH / 2, GOLD_L, 40, 260);
        heads.destroy();
        tails.destroy();
        logo.alpha = 1;
        const front = logo.texture;
        k.tw.add(2.2, (t) => {
          const c = Math.cos(t * Math.PI * 2);
          logo.texture = c >= 0 || !back ? front : back;
          logo.scale.set(0.55 * Math.max(0.02, Math.abs(c)), 0.55);
        }, { ease: ease.inOutSine });
      });
    },
  },
];

// ---------- between chapters ----------

function vignette(n: number): Shot[] {
  return [
    { // This layer is done: the two walk to the seam and meet, while the next layer's Tarnish creeps up behind.
      dur: 5.6, make(k) {
        const sm = seam(k, VW / 2);
        k.cam.addChild(floor(k, 0, n, 0, 0, VW / 2, VH), floor(k, 1, n, VW / 2, 0, VW / 2, VH), sm);
        // The stalker: small (far away), dimmed, hopping in from the left edge one step at a time.
        const next = Math.min(n + 1, 6);
        const foe = art(k, `chars/tarnish/ch${next}.awake`, -60, 260, 1.3);
        foe.tint = 0x9a8aa8;
        foe.alpha = 0.85;
        k.cam.addChild(foe);
        k.tick((_, t) => {
          const hop = Math.max(0, Math.min(5, Math.floor((t - 0.6) / 0.8)));
          const f = (t - 0.6) / 0.8 - hop;
          foe.x = -60 + 60 * (hop + (f > 0 && hop < 5 ? Math.min(1, f * 3) : 0));
          foe.y = 260 - (f > 0 && f < 0.33 && hop < 5 ? Math.sin(f * 3 * Math.PI) * 10 : 0);
        });
        for (let i = 0; i < 3; i++) k.tw.wait(0.8 + i * 1.6).then(() => audio.sfx('foeStep', 0));
        k.over.addChild(vignetteOverlay());
        puppetAt(k, k.sol, VW / 2 - 260, 420, 2.4, 1);
        puppetAt(k, k.lune, VW / 2 + 260, 420, 2.4, -1);
        k.sol.walking = k.lune.walking = true;
        push(k, VW / 2, 330, 1, 1.08, 5.4);
        k.tw.add(2.2, (t) => { k.sol.x = VW / 2 - 260 + 215 * t; k.lune.x = VW / 2 + 260 - 215 * t; sm.alpha = 1 - 0.7 * t; }, { delay: 0.3, ease: ease.inOutSine })
          .then(() => {
            k.sol.walking = k.lune.walking = false;
            k.sol.mood = k.lune.mood = 'celebrate';
            audio.sfx('align');
            burst(k, VW / 2, 340, GOLD_L, 24, 180);
            thread(k, VW / 2 - 45, 350, VW / 2 + 45, 350, 0.5);
          });
        k.tw.wait(4.2).then(() => { k.sol.mood = k.lune.mood = 'idle'; });
      },
    },
    { // Deeper: the halves fall into the next layer, a little closer together each time.
      dur: 3.8, make(k) {
        tunnel(k, 1, 3.8);
        const gap = 300 - (n / 6) * 240, heads = coin(28, -1), tails = coin(28, 1);
        heads.position.set(VW / 2 - gap / 2, VH / 2);
        tails.position.set(VW / 2 + gap / 2, VH / 2);
        k.cam.addChild(heads, tails);
        k.tick((_, t) => { heads.rotation = -0.25 + 0.15 * Math.sin(t * 4); tails.rotation = -heads.rotation; heads.y = tails.y = VH / 2 + Math.sin(t * 5) * 8; });
      },
    },
    { // Up at the well the two who made the wish turn a little more toward each other.
      dur: 4.4, make(k) {
        const before = new Container(), after = new Container();
        for (const [c, turn] of [[before, (n - 1) / 6], [after, n / 6]] as const) {
          wellScene({ ...k, cam: c }, turn);
          k.cam.addChild(c);
        }
        fireflies(k, 10, 0xd8ff9a);
        k.over.addChild(vignetteOverlay());
        after.alpha = 0;
        push(k, VW / 2, 360, 1.05, 1, 4.2);
        k.tw.add(1.6, (t) => { before.alpha = 1 - t; after.alpha = t; }, { delay: 1.4 });
      },
    },
  ];
}

// ---------- the ending ----------

const ending: Shot[] = [
  { // The Rim: the two halves of the world close like a coin, and Sol and Lune walk to each other.
    dur: 8.6, make(k) {
      const left = floor(k, 0, 6, -VW / 2, 0, VW / 2, VH), right = floor(k, 1, 6, VW, 0, VW / 2, VH);
      k.cam.addChild(new Graphics().rect(0, 0, VW, VH).fill(0x1c1730), left, right);
      k.over.addChild(vignetteOverlay());
      k.tw.add(1.4, (t) => { left.x = -VW / 2 + (VW / 2) * t; right.x = VW - (VW / 2) * t; }, { ease: ease.outQuad }).then(() => {
        audio.sfx('align');
        const line = new Graphics().rect(-3, 0, 6, VH).fill(0xffffff);
        line.x = VW / 2;
        k.cam.addChild(line);
        k.tw.add(0.8, (t) => { line.alpha = 1 - t; line.scale.x = 1 + 4 * t; }).then(() => line.destroy());
      });
      puppetAt(k, k.sol, 120, 420, 2.4, 1);
      puppetAt(k, k.lune, VW - 120, 420, 2.4, -1);
      k.sol.alpha = k.lune.alpha = 0;
      k.tw.add(0.5, (t) => (k.sol.alpha = k.lune.alpha = t), { delay: 1.2 });
      k.tw.wait(1.8).then(() => { k.sol.walking = k.lune.walking = true; });
      k.tw.add(3.2, (t) => { k.sol.x = 120 + (VW / 2 - 175) * t; k.lune.x = VW - 120 - (VW / 2 - 175) * t; }, { delay: 1.8, ease: ease.linear }).then(() => {
        k.sol.walking = k.lune.walking = false;
        k.sol.mood = k.lune.mood = 'celebrate';
        // The two pendants rise from them and join into one coin.
        const a = coin(16, -1), b = coin(16, 1), g = glow(80, GOLD_L, 0.45);
        a.position.set(VW / 2 - 55, 330);
        b.position.set(VW / 2 + 55, 330);
        g.position.set(VW / 2, 220);
        g.alpha = 0;
        k.cam.addChild(g, a, b);
        k.tw.add(1, (t) => { a.position.set(VW / 2 - 55 * (1 - t), 330 - 110 * t); b.position.set(VW / 2 + 55 * (1 - t), 330 - 110 * t); }, { ease: ease.inOutSine }).then(() => {
          audio.sfx('levelComplete');
          flash(k, 0.6, GOLD_L);
          burst(k, VW / 2, 220, GOLD_L, 50, 260);
          a.destroy();
          b.destroy();
          const whole = coin(30);
          whole.position.set(VW / 2, 220);
          k.cam.addChild(whole);
          g.alpha = 1;
          k.tick((_, t) => (whole.scale.x = Math.cos(t * 2)));
        });
      });
      push(k, VW / 2, 330, 1, 1.1, 6, 2);
    },
  },
  { // The light of the whole coin washes over the Tarnish, and they shine back into ordinary coins.
    dur: 5.6, make(k) {
      k.cam.addChild(new Graphics().rect(0, 0, VW, VH).fill(0x1c1730));
      const ring = new Graphics();
      k.cam.addChild(ring);
      // One Tarnish from each chapter of the well.
      const foes = [[170, 220], [330, 400], [500, 130], [650, 380], [800, 240], [480, 470]].map(([x, y], i) => {
        const s = art(k, i ? `chars/tarnish/ch${i + 1}.awake` : 'chars/tarnish/awake', x, y, 1.3, 0.5, 0.5);
        k.cam.addChild(s);
        return { s, x, y, d: Math.hypot(x - VW / 2, y - VH / 2), done: false };
      });
      const halo = glow(60, GOLD_L, 0.5), core = coin(26);
      for (const c of [halo, core]) { c.position.set(VW / 2, VH / 2); k.cam.addChild(c); }
      k.tick((_, t) => {
        const r = Math.max(0, (t - 0.4) * 260);
        ring.clear().circle(VW / 2, VH / 2, r).stroke({ width: 14, color: GOLD_L, alpha: Math.max(0, 0.7 - r / 900) });
        core.scale.x = Math.cos(t * 2);
        for (const f of foes) {
          if (f.done || r < f.d) continue;
          f.done = true;
          audio.sfx('flip');
          burst(k, f.x, f.y, GOLD_L, 22, 180);
          f.s.destroy();
          const c = coin(20);
          c.position.set(f.x, f.y);
          k.cam.addChild(c);
          k.tw.add(1.6, (u) => { c.scale.x = Math.cos(u * 12); c.y = f.y - 40 * Math.sin(u * Math.PI); }, { ease: ease.linear });
        }
      });
    },
  },
  { // The whole coin rises back up through every layer, toward the light.
    dur: 5, make(k) {
      tunnel(k, -1, 5);
      const g = glow(90, GOLD_L, 0.4), c = coin(40);
      for (const x of [g, c]) { x.position.set(VW / 2, VH / 2); k.cam.addChild(x); }
      k.tick((_, t) => (c.scale.x = Math.cos(t * 6)));
      const white = new Graphics().rect(0, 0, VW, VH).fill(0xfff8e6);
      white.alpha = 0;
      k.over.addChild(white);
      k.tw.add(1.2, (t) => (white.alpha = t), { delay: 3.8, ease: ease.inQuad });
    },
  },
  { // Dawn at the well. The coin comes back up to the two who wished, now side by side.
    dur: 10, make(k) {
      const s = wellScene(k, 1, true);
      fireflies(k, 16, 0xfff4d6, { x: 60, y: 120, w: 840, h: 300 });
      flash(k, 1.4, 0xfff8e6);
      k.tw.add(9, (t) => { s.sky.y = VH / 2 + 30 * t; s.hills.y = VH / 2 + 10 * t; });
      push(k, VW / 2, 360, 1.15, 1, 8);
      const c = coin(10), g = glow(30, GOLD_L, 0.6);
      c.position.set(VW / 2, 350);
      c.alpha = g.alpha = 0;
      k.cam.addChild(g, c);
      k.tw.wait(1.6).then(() => {
        c.alpha = g.alpha = 1;
        audio.sfx('flip');
        burst(k, VW / 2, 350, GOLD_L, 20, 120);
        k.tw.add(1.8, (t) => {
          c.position.set(VW / 2, 350 - Math.sin(t * Math.PI * 0.8) * 140 + 10 * t);
          c.scale.x = Math.cos(t * 16);
          g.position.copyFrom(c.position);
        }, { ease: ease.outQuad }).then(() => {
          audio.sfx('levelComplete');
          burst(k, c.x, c.y, GOLD_L, 30, 160);
          k.tick((_, t) => { c.scale.x = Math.cos(t * 1.5); g.alpha = 0.7 + 0.3 * Math.sin(t * 2); });
        });
      });
      const thanks = text('Thank you for playing', 30, C.goldLight);
      thanks.anchor.set(0.5);
      thanks.position.set(VW / 2, 70);
      thanks.alpha = 0;
      k.over.addChild(thanks);
      k.tw.add(1.5, (t) => (thanks.alpha = t), { delay: 6.5 });
    },
  },
];

const SHOTS = (s: Story): Shot[] => (s.kind === 'intro' ? intro : s.kind === 'ending' ? ending : vignette(s.chapter));

/** Plays a story, then calls `done` (also on skip). The intro first asks for a key so it has sound. */
export function createStory(ctx: Ctx, story: Story, done: () => void): Scene {
  const root = new Container(), stage = new Container(), frame = new Graphics(), shots = new Container();
  const tw = new Tweens(), fx = new Particles(), over = new Container();
  stage.addChild(shots, fx, over);
  const skip = text('any key to skip', 16, C.silverDark);
  const begin = text('press any key', 26, C.goldLight);
  root.addChild(stage, frame, skip, begin);
  root.eventMode = 'static';
  root.on('pointertap', () => press());

  const list = SHOTS(story);
  let finished = false, started = false, kit: Kit | null = null, shot = 0, clock = 0, shakeT = 0, shotClock = 0;
  let ticks: ((dt: number, t: number) => void)[] = [];
  const finish = () => { if (!finished) { finished = true; done(); } };
  // The intro's first key is the one that lets the browser play sound: it starts, it doesn't skip.
  const needsKey = story.kind === 'intro' && !audio.unlocked;
  begin.visible = needsKey;
  const press = () => {
    if (started) return finish();
    if (!needsKey || !kit) return;
    begin.visible = false;
    started = true;
    audio.unlock().finally(play);
  };

  const play = () => {
    if (finished || !kit) return;
    if (shot >= list.length) return finish();
    const cam = new Container(), holder = new Container();
    holder.alpha = 0;
    holder.mask = new Graphics().rect(0, 0, VW, VH).fill(0xffffff);
    holder.addChild(holder.mask as Graphics, cam);
    shots.addChild(holder);
    const old = shots.children.filter((c) => c !== holder);
    over.removeChildren().forEach((c) => c.destroy({ children: true }));
    ticks = [];
    shotClock = 0;
    list[shot].make({ ...kit, cam, over });
    tw.add(0.5, (t) => { holder.alpha = t; old.forEach((o) => (o.alpha = 1 - t)); }).then(() => old.forEach((o) => {
      // Puppets are reused across shots: take them out before the old shot is destroyed.
      for (const p of [kit!.sol, kit!.lune]) if (p.parent?.parent === o) p.removeFromParent();
      o.destroy({ children: true });
    }));
    tw.wait(list[shot].dur).then(() => { shot++; play(); });
  };

  Promise.all([loadPuppet('sol'), loadPuppet('lune')]).then(([sol, lune]) => {
    sol.partnerSide = 1;
    lune.partnerSide = -1;
    kit = {
      cam: shots, over, tw, fx, sol, lune, ctx,
      tick: (fn) => ticks.push(fn),
      shake: (sec) => { if (!ctx.settings().reducedMotion) shakeT = Math.max(shakeT, sec); },
    };
    if (!needsKey) { started = true; play(); }
  }).catch(finish);

  const layout = (w: number, h: number) => {
    const k = Math.min(w / (VW + 40), h / (VH + 40));
    stage.scale.set(k);
    stage.position.set((w - VW * k) / 2, (h - VH * k) / 2);
    // A storybook frame: dark page, a gold rule, a thin outer line.
    frame.clear()
      .rect(0, 0, w, h).fill(0x0e1028).rect(stage.x, stage.y, VW * k, VH * k).cut()
      .rect(stage.x - 6, stage.y - 6, VW * k + 12, VH * k + 12).stroke({ width: 3, color: GOLD })
      .rect(stage.x - 12, stage.y - 12, VW * k + 24, VH * k + 24).stroke({ width: 1, color: GOLD, alpha: 0.5 });
    skip.position.set(w - skip.width - 20, h - skip.height - 12);
    begin.anchor.set(0.5);
    begin.position.set(w / 2, h / 2);
  };

  return {
    root,
    enter() { layout(window.innerWidth, window.innerHeight); },
    resize: layout,
    update(dt) {
      clock += dt;
      begin.alpha = 0.55 + 0.45 * Math.sin(clock * 3);
      if (!started) return;
      shotClock += dt;
      tw.update(dt);
      fx.update(dt);
      // A per-frame effect that fails (its objects already gone) drops out instead of stopping the scene.
      ticks = ticks.filter((fn) => { try { fn(dt, shotClock); return true; } catch { return false; } });
      kit?.sol.update(dt);
      kit?.lune.update(dt);
      shakeT = Math.max(0, shakeT - dt);
      const m = shakeT * 24;
      shots.position.set((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      skip.alpha = Math.max(0, 0.8 - Math.max(0, clock - 4));
    },
    onAction() { press(); return true; },
  };
}
