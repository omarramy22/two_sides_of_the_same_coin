// Board renderer: Phase 2 art sprites by default (`?greybox` forces the flat Phase 1 look).
// Everything is drawn straight from the engine State and events. No game rules here.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { History } from '../engine/history';
import { isGate, isPlate, parseLevel } from '../engine/parse';
import { gateJammed, gateOpen, isWon, tick } from '../engine/tick';
import type { Dir, GameEvent, Level, LevelFile, State, W } from '../engine/types';
import { actor, drawBackground, drawSeam, drawTerrain, loadArt, type Art } from './sprites';

const files = import.meta.glob<LevelFile>('../levels/*.json', { eager: true, import: 'default' });
const order = (id: string) => id.split('-').map(Number);
const levels: Level[] = Object.values(files).map(parseLevel)
  .sort((a, b) => order(a.id)[0] - order(b.id)[0] || order(a.id)[1] - order(b.id)[1]);

const MOVES: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
};
const OTHER_KEYS = ['z', 'Backspace', 'r', 'n', 'p', 'Enter'];
const PAL = [
  { floor: 0xf6d58e, wall: 0x8a4b22, goal: 0x6f9e4c, pit: 0x2a1e14, hero: 0xe8b66a, ink: 0x2a1e14 },
  { floor: 0x2e3570, wall: 0x0e1028, goal: 0x2e8c8a, pit: 0x000000, hero: 0xc9d3e6, ink: 0xe8f0ff },
];
const SEAM = 0.4, HUD = 48, MARGIN = 16;
const ANIM_MS = 140;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

interface MoveAnim {
  prev: State;
  next: State;
  ev: GameEvent[];
  startTime: number;
}

interface FlipEffect {
  startTime: number;
  flipEvents: GameEvent[];
  alignCell: number;
}

declare global { interface Window { __game: unknown } }

function getLayout(lv: Level) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const landscape = vw >= vh;
  const cols = landscape ? lv.w * 2 + SEAM : lv.w, rows = landscape ? lv.h : lv.h * 2 + SEAM;
  const t = Math.max(8, Math.floor(Math.min((vw - 2 * MARGIN) / cols, (vh - HUD - 2 * MARGIN) / rows)));
  const ox = (vw - cols * t) / 2, oy = HUD + MARGIN + (vh - HUD - 2 * MARGIN - rows * t) / 2;
  const origin = (w: W): [number, number] =>
    landscape ? [ox + w * (lv.w + SEAM) * t, oy] : [ox, oy + w * (lv.h + SEAM) * t];
  const cell = (w: W, i: number): [number, number] => {
    const [x0, y0] = origin(w);
    return [x0 + (i % lv.w) * t, y0 + Math.floor(i / lv.w) * t];
  };
  return { vw, vh, landscape, t, ox, oy, cell };
}

function drawCrate(g: Graphics, x: number, y: number, t: number, scale = 1, alpha = 1) {
  const cx = x + t / 2, cy = y + t / 2;
  const sz = t * 0.7 * scale;
  const left = cx - sz / 2, top = cy - sz / 2;
  g.rect(left, top, sz, sz)
    .fill({ color: 0xc8643b, alpha })
    .stroke({ width: 2 * scale, color: 0x2a1e14, alpha });
}

function drawTarnish(
  g: Graphics,
  scene: Container,
  cx: number,
  cy: number,
  t: number,
  awake: boolean,
  inkColor: number,
  scale = 1,
  alpha = 1,
) {
  const r = t * 0.3 * scale;
  const fill = awake ? { color: 0xb5543a, alpha } : { color: 0x7d6b55, alpha: 0.85 * alpha };
  const outline = { width: 2 * scale, color: 0x2a1e14, alpha };

  // Jagged crown / spikes on top
  g.poly([
    cx - r * 0.6, cy - r * 0.7,
    cx - r * 0.45, cy - r * 1.3,
    cx - r * 0.2, cy - r * 0.95,
    cx, cy - r * 1.4,
    cx + r * 0.2, cy - r * 0.95,
    cx + r * 0.45, cy - r * 1.3,
    cx + r * 0.6, cy - r * 0.7,
  ], true).fill(fill).stroke(outline);

  // Body circle
  g.circle(cx, cy, r).fill(fill).stroke(outline);

  if (awake) {
    const eyeR = Math.max(1.5, t * 0.04 * scale);
    g.circle(cx - r * 0.35, cy - r * 0.05, eyeR).fill({ color: 0xffe08a, alpha });
    g.circle(cx + r * 0.35, cy - r * 0.05, eyeR).fill({ color: 0xffe08a, alpha });
  } else {
    g.moveTo(cx - r * 0.5, cy - r * 0.05).lineTo(cx - r * 0.2, cy - r * 0.05).stroke(outline);
    g.moveTo(cx + r * 0.2, cy - r * 0.05).lineTo(cx + r * 0.5, cy - r * 0.05).stroke(outline);

    const zTxt = new Text({
      text: 'z',
      style: { fill: inkColor, fontSize: Math.max(8, Math.round(t * 0.28 * scale)), fontFamily: 'sans-serif', fontWeight: 'bold' },
    });
    zTxt.alpha = alpha;
    zTxt.anchor.set(0.5);
    zTxt.position.set(cx + r * 0.75, cy - r * 0.75);
    scene.addChild(zTxt);
  }
}

function drawHero(
  g: Graphics,
  cx: number,
  cy: number,
  t: number,
  fallen: boolean,
  heroColor: number,
  inkColor: number,
) {
  g.circle(cx, cy, t * 0.32)
    .fill(fallen ? 0x777777 : heroColor)
    .stroke({ width: 2, color: inkColor });
}

export function startGreybox(app: Application) {
  let index = 0, lv = levels[0], hist = new History(lv.start);
  let scene = new Container();
  const queue: string[] = [];
  let moveAnim: MoveAnim | null = null;
  let flipEffect: FlipEffect | null = null;
  let art: Art | null = null;
  let actors = new Container();
  if (!new URLSearchParams(location.search).has('greybox')) {
    loadArt().then((a) => { art = a; draw(); }).catch((e) => console.warn('art not loaded, using greybox:', e));
  }
  const puppets = () => (art ? [art.sol, art.lune] : []);

  function load(i: number) {
    moveAnim = null;
    flipEffect = null;
    index = (i + levels.length) % levels.length;
    lv = levels[index];
    hist = new History(lv.start);
    draw();
  }

  function startMoveAnim(prev: State, next: State, ev: GameEvent[]) {
    const flipEvents = ev.filter((e) => e.type === 'flip');
    if (flipEvents.length > 0) {
      flipEffect = {
        startTime: performance.now(),
        flipEvents,
        alignCell: next.pos[0],
      };
    }
    moveAnim = {
      prev,
      next,
      ev,
      startTime: performance.now(),
    };
    renderAnimFrame(0);
  }

  function handle(key: string) {
    const dir = MOVES[key];
    if (dir) {
      const prev = hist.state;
      const ev: GameEvent[] = [];
      const next = tick(lv, prev, dir, ev);
      if (next === prev) return;
      hist.push(next);
      puppets().forEach((p, w) => {
        p.walking = next.pos[w] !== prev.pos[w];
        if (dir === 'left' || dir === 'right') p.facing = dir === 'left' ? -1 : 1;
      });
      startMoveAnim(prev, next, ev);
    } else if (key === 'z' || key === 'Backspace') {
      moveAnim = null;
      flipEffect = null;
      hist.undo();
      draw();
    } else if (key === 'r') {
      moveAnim = null;
      flipEffect = null;
      hist.restart();
      draw();
    } else if (key === 'n') {
      return load(index + 1);
    } else if (key === 'p') {
      return load(index - 1);
    } else if (key === 'Enter' && isWon(hist.state)) {
      return load(index + 1);
    }
  }

  const press = (raw: string) => {
    const key = raw.length === 1 ? raw.toLowerCase() : raw;
    if (key in MOVES || OTHER_KEYS.includes(key)) { queue.push(key); return true; }
    return false;
  };
  window.addEventListener('keydown', (e) => { if (press(e.key)) e.preventDefault(); });

  app.ticker.add(() => {
    const now = performance.now();
    if (moveAnim) {
      const progress = Math.min(1, (now - moveAnim.startTime) / ANIM_MS);
      if (progress < 1) {
        renderAnimFrame(progress);
        return;
      }
      moveAnim = null;
      puppets().forEach((p) => (p.walking = false));
      draw();
    }
    puppets().forEach((p) => p.update(app.ticker.deltaMS / 1000));

    // Process next queued key only when no animation is running
    if (queue.length > 0) {
      const k = queue.shift()!;
      handle(k);
      return;
    }

    // Passive flip effect animation over static frame
    if (flipEffect) {
      if (now - flipEffect.startTime < 1200) {
        draw();
      } else {
        flipEffect = null;
        draw();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (moveAnim) {
      renderAnimFrame(Math.min(1, (performance.now() - moveAnim.startTime) / ANIM_MS));
    } else {
      draw();
    }
  });

  // Art sprites when loaded, flat shapes otherwise. (cx, cy) = cell centre; actors stand 0.3 tile below it.
  function crateAt(g: Graphics, x: number, y: number, t: number, scale = 1, alpha = 1) {
    if (art) actors.addChild(actor(art, 'tiles/crate', x + t / 2, y + t * 0.9, t, scale, alpha));
    else drawCrate(g, x, y, t, scale, alpha);
  }
  function tarnishAt(g: Graphics, sc: Container, cx: number, cy: number, t: number, awake: boolean, ink: number, scale = 1, alpha = 1) {
    if (art) actors.addChild(actor(art, `chars/tarnish/${awake ? 'awake' : 'asleep'}`, cx, cy + t * 0.3, t, scale, alpha));
    else drawTarnish(g, sc, cx, cy, t, awake, ink, scale, alpha);
  }
  function heroAt(g: Graphics, w: W, cx: number, cy: number, t: number, fallen: boolean) {
    if (!art) return drawHero(g, cx, cy, t, fallen, PAL[w].hero, PAL[w].ink);
    const p = w ? art.lune : art.sol;
    p.scale.set(t / 64);
    p.position.set(cx, cy + t * 0.3);
    p.zIndex = p.y;
    p.alpha = fallen ? 0.5 : 1;
    actors.addChild(p);
  }

  function drawScene(
    state: State,
    opts: {
      terrainState?: State;
      skipCrates?: Set<string>;
      skipTarnish?: Set<string>;
      skipHeroes?: boolean;
      suppressMessages?: boolean;
    } = {},
  ) {
    puppets().forEach((p) => p.removeFromParent()); // they persist across redraws
    scene.destroy({ children: true });
    scene = new Container();
    app.stage.addChild(scene);

    const layout = getLayout(lv);
    const { vw, vh, landscape, t, ox, oy, cell } = layout;
    const back = new Container(), g = new Graphics();
    actors = new Container();
    actors.sortableChildren = true;
    scene.addChild(back, g, actors);

    const label = (text: string, x: number, y: number, fill: number) => {
      const txt = new Text({ text, style: { fill, fontSize: Math.round(t * 0.4), fontFamily: 'sans-serif', fontWeight: 'bold' } });
      txt.anchor.set(0.5);
      txt.position.set(x + t / 2, y + t / 2);
      scene.addChild(txt);
    };

    const terrain = opts.terrainState ?? state;

    // Seam between the worlds.
    if (art) {
      const [sx] = cell(0, state.pos[0]), [lx] = cell(1, state.pos[1]);
      drawBackground(art, back, vw, vh, (sx + lx) / 2);
      for (const w of [0, 1] as W[]) drawTerrain(art, back, lv, terrain, w, cell, t);
      if (landscape) drawSeam(art, back, true, ox + lv.w * t, oy, SEAM * t, lv.h * t);
      else drawSeam(art, back, false, ox, oy + lv.h * t, lv.w * t, SEAM * t);
    } else if (landscape) g.rect(ox + lv.w * t, oy, SEAM * t, lv.h * t).fill(0xb8a47a);
    else g.rect(ox, oy + lv.h * t, lv.w * t, SEAM * t).fill(0xb8a47a);

    for (const w of [0, 1] as W[]) {
      const p = PAL[w];
      for (let i = 0; i < lv.w * lv.h; i++) {
        const [x, y] = cell(w, i), c = terrain.tiles[w][i];
        const cx = x + t / 2;
        if (art && '#.G^,;'.includes(c)) {
          // terrain sprite already drawn
        } else if (art) {
          if (c === '|') g.rect(x, y, t, t).fill(0x6b5b3a);
        } else g.rect(x, y, t, t).fill(c === '#' ? p.wall : c === '|' ? 0x6b5b3a : p.floor);
        if (art && '#.G^,;'.includes(c)) {
          // nothing
        } else if (c === 'G') g.rect(x + t * 0.1, y + t * 0.1, t * 0.8, t * 0.8).fill(p.goal);
        else if (c === '^') g.rect(x + t * 0.05, y + t * 0.05, t * 0.9, t * 0.9).fill(p.pit);
        else if (c === ',' || c === ';') {
          g.rect(x + t * 0.06, y + t * 0.06, t * 0.88, t * 0.88).fill({ color: 0x5a4632, alpha: 0.5 });
          if (c === ',') {
            const cx0 = x + t * 0.22, cy0 = y + t * 0.22, cw = t * 0.56;
            g.rect(cx0, cy0, cw, cw).fill({ color: 0xc8643b, alpha: 0.75 });
            g.moveTo(cx0, cy0).lineTo(cx0 + cw, cy0 + cw).stroke({ width: 1.5, color: 0x2a1e14 });
            g.moveTo(cx0 + cw, cy0).lineTo(cx0, cy0 + cw).stroke({ width: 1.5, color: 0x2a1e14 });
          } else {
            const cy = y + t / 2, cr = t * 0.28;
            const fill = { color: 0x7d4a33, alpha: 0.8 };
            const outline = { width: 1.5, color: 0x2a1e14 };
            g.poly([
              cx - cr * 0.5, cy - cr * 0.7,
              cx - cr * 0.38, cy - cr * 1.2,
              cx - cr * 0.18, cy - cr * 0.9,
              cx, cy - cr * 1.3,
              cx + cr * 0.18, cy - cr * 0.9,
              cx + cr * 0.38, cy - cr * 1.2,
              cx + cr * 0.5, cy - cr * 0.7,
            ], true).fill(fill).stroke(outline);
            g.circle(cx, cy, cr).fill(fill).stroke(outline);
          }
        } else if (isPlate(c)) {
          g.rect(x + t * 0.2, y + t * 0.2, t * 0.6, t * 0.6).fill(0x9c8cd4);
          label(c, x, y, 0x1c2046);
        } else if (isGate(c)) {
          if (gateOpen(lv, terrain, w, i)) {
            g.rect(x + 2, y + 2, t - 4, t - 4).stroke({ width: gateJammed(lv, terrain, w, i) ? 5 : 2, color: gateJammed(lv, terrain, w, i) ? 0xe07a6b : 0x4a5a8c });
          } else g.rect(x, y, t, t).fill(0x4a5a8c);
          label(c, x, y, p.ink);
        } else if (c === '/') {
          const lpx = x + t * 0.1, lpy = y + t * 0.35, lpw = t * 0.8, lph = t * 0.3;
          const rad = Math.max(2, t * 0.05);
          g.poly([cx, lpy + lph - 1, cx - t * 0.08, lpy + lph + t * 0.12, cx + t * 0.08, lpy + lph + t * 0.12], true).fill(0x2a1e14);
          g.roundRect(lpx, lpy, lpw, lph, rad).fill(0xa0703c).stroke({ width: 2, color: 0x2a1e14 });
          g.moveTo(lpx + lpw * 0.28, lpy + lph * 0.25).lineTo(lpx + lpw * 0.28, lpy + lph * 0.75).stroke({ width: 1.5, color: 0x2a1e14 });
          g.moveTo(lpx + lpw * 0.5, lpy + lph * 0.2).lineTo(lpx + lpw * 0.5, lpy + lph * 0.7).stroke({ width: 1.5, color: 0x2a1e14 });
          g.moveTo(lpx + lpw * 0.72, lpy + lph * 0.25).lineTo(lpx + lpw * 0.72, lpy + lph * 0.75).stroke({ width: 1.5, color: 0x2a1e14 });
        } else if (c === '|') {
          g.rect(x, y, t, t).fill(0x6b5b3a);
          const rpx = x + t * 0.07, rpy = y + t * 0.18, rpw = t * 0.86, rph = t * 0.4;
          const rad = Math.max(2, t * 0.05);
          g.roundRect(rpx, rpy + t * 0.12, rpw, rph, rad).fill({ color: 0x000000, alpha: 0.35 });
          g.poly([cx, rpy + rph - 1, cx - t * 0.08, rpy + rph + t * 0.12, cx + t * 0.08, rpy + rph + t * 0.12], true).fill(0x2a1e14);
          g.roundRect(rpx, rpy, rpw, rph, rad).fill(0xc08850).stroke({ width: 2, color: 0x2a1e14 });
          const cyPlank = rpy + rph / 2;
          g.moveTo(cx - t * 0.08, cyPlank + t * 0.04).lineTo(cx, cyPlank - t * 0.05).lineTo(cx + t * 0.08, cyPlank + t * 0.04).stroke({ width: 2.5, color: 0x2a1e14 });
        }

        if (state.objs[w][i] === 'C' && !opts.skipCrates?.has(`${w}:${i}`)) crateAt(g, x, y, t);
      }

      for (let i = 0; i < lv.w * lv.h; i++) {
        const obj = state.objs[w][i];
        if (obj !== '@' && obj !== '?') continue;
        if (opts.skipTarnish?.has(`${w}:${i}`)) continue;
        const [x, y] = cell(w, i);
        tarnishAt(g, scene, x + t / 2, y + t / 2, t, obj === '@', p.ink);
      }

      if (!opts.skipHeroes) {
        const [hx, hy] = cell(w, state.pos[w]);
        heroAt(g, w, hx + t / 2, hy + t / 2, t, state.fallen[w]);
      }
    }

    // Alignment thread across the seam.
    if (!opts.skipHeroes && state.pos[0] === state.pos[1]) {
      const [ax, ay] = cell(0, state.pos[0]), [bx, by] = cell(1, state.pos[1]);
      if (art) {
        // Pendants glow and a thread of light crosses the seam (SPEC.md §2.4); it stays out of the board.
        const fx = new Graphics();
        const [a, b] = [[ax + t / 2, ay + t / 2], [bx + t / 2, by + t / 2]];
        for (const [x, y] of [a, b]) fx.circle(x, y, t * 0.32).fill({ color: 0xfff4d6, alpha: 0.28 }).circle(x, y, t * 0.12).fill({ color: 0xfff4d6, alpha: 0.6 });
        const [s0, s1] = landscape
          ? [[ox + (lv.w - 0.25) * t, a[1]], [ox + (lv.w + SEAM + 0.25) * t, b[1]]]
          : [[a[0], oy + (lv.h - 0.25) * t], [b[0], oy + (lv.h + SEAM + 0.25) * t]];
        fx.moveTo(s0[0], s0[1]).lineTo(s1[0], s1[1]).stroke({ width: t * 0.14, color: 0xfff4d6, alpha: 0.35 })
          .moveTo(s0[0], s0[1]).lineTo(s1[0], s1[1]).stroke({ width: t * 0.05, color: 0xffffff, alpha: 0.9 });
        scene.addChild(fx);
      } else g.moveTo(ax + t / 2, ay + t / 2).lineTo(bx + t / 2, by + t / 2).stroke({ width: 3, color: 0xfff4d6, alpha: 0.9 });
    }

    const hud = new Text({
      text: `${lv.id} ${lv.name}  ·  moves ${hist.moves}  ·  par ${lv.par ?? '-'}`,
      style: { fill: 0xe8f0ff, fontSize: 22, fontFamily: 'sans-serif' },
    });
    hud.position.set(MARGIN, (HUD - 22) / 2 + MARGIN / 2);
    const hudBack = new Graphics().roundRect(MARGIN - 10, hud.y - 6, hud.width + 20, hud.height + 12, 8).fill({ color: 0x0e1028, alpha: 0.6 });
    scene.addChild(hudBack, hud);

    if (!opts.suppressMessages) {
      const caught = (state.fallen[0] && state.objs[0][state.pos[0]] === '@') || (state.fallen[1] && state.objs[1][state.pos[1]] === '@');
      const msg = isWon(state) ? `Solved in ${hist.moves} moves. Enter for next level`
        : caught ? 'Caught! Press Z to undo or R to restart'
        : state.fallen[0] || state.fallen[1] ? 'Fell! Press Z to undo or R to restart' : '';
      if (msg) {
        const txt = new Text({ text: msg, style: { fill: 0xffffff, fontSize: 26, fontFamily: 'sans-serif' } });
        txt.anchor.set(0.5);
        txt.position.set(vw / 2, vh / 2);
        const back = new Graphics().roundRect(vw / 2 - txt.width / 2 - 20, vh / 2 - 30, txt.width + 40, 60, 10).fill({ color: 0x000000, alpha: 0.7 });
        scene.addChild(back, txt);
      }
    }

    return { g, scene, layout };
  }

  function drawFlipOverlay(g: Graphics, scene: Container, layout: ReturnType<typeof getLayout>) {
    if (!flipEffect) return;
    const now = performance.now();
    const elapsed = now - flipEffect.startTime;
    if (elapsed >= 1200) {
      flipEffect = null;
      return;
    }

    const { t, cell, vw } = layout;

    // Seam flash & bursts & rings (lasts 500 ms)
    if (elapsed < 500) {
      const pFlip = elapsed / 500;
      const [ax, ay] = cell(0, flipEffect.alignCell);
      const [bx, by] = cell(1, flipEffect.alignCell);
      const acx = ax + t / 2, acy = ay + t / 2;
      const bcx = bx + t / 2, bcy = by + t / 2;
      const lineAlpha = Math.max(0, 1 - pFlip);

      // Flash along the line between the two characters' cells across the seam
      g.moveTo(acx, acy).lineTo(bcx, bcy).stroke({ width: 0.25 * t, color: 0xfff4d6, alpha: lineAlpha });

      // Filled circle burst centred on each character
      const burstR = (0.3 + 0.9 * pFlip) * t;
      const burstAlpha = Math.max(0, 0.8 * (1 - pFlip));
      g.circle(acx, acy, burstR).fill({ color: 0xfff4d6, alpha: burstAlpha });
      g.circle(bcx, bcy, burstR).fill({ color: 0xfff4d6, alpha: burstAlpha });

      // Ring pulse on every Tarnish that flipped
      const ringR = (0.3 + 0.4 * pFlip) * t;
      const ringAlpha = Math.max(0, 1 - pFlip);
      for (const ev of flipEffect.flipEvents) {
        const [tx, ty] = cell(ev.world, ev.at);
        g.circle(tx + t / 2, ty + t / 2, ringR).stroke({ width: 3, color: 0xfff4d6, alpha: ringAlpha });
      }
    }

    // Caption centred under the HUD (lasts 1.2 s)
    if (elapsed < 1200) {
      const caption = new Text({
        text: 'The halves line up: the Tarnish flip!',
        style: { fill: 0xffffff, fontSize: 18, fontFamily: 'sans-serif' },
      });
      caption.anchor.set(0.5, 0.5);
      caption.position.set(vw / 2, HUD + 10);
      scene.addChild(caption);
    }
  }

  function draw() {
    const { g, scene: curScene, layout } = drawScene(hist.state);
    drawFlipOverlay(g, curScene, layout);
  }

  function renderAnimFrame(progress: number) {
    if (!moveAnim) return;
    const tEase = easeOut(progress);

    const skipCrates = new Set<string>();
    const skipTarnish = new Set<string>();

    for (const ev of moveAnim.ev) {
      if ((ev.type === 'push' || ev.type === 'fill') && ev.from !== undefined) {
        skipCrates.add(`${ev.world}:${ev.at}`);
      } else if ((ev.type === 'foeStep' || ev.type === 'foeFall') && ev.from !== undefined) {
        skipTarnish.add(`${ev.world}:${ev.at}`);
      }
    }

    const { g, scene: curScene, layout } = drawScene(moveAnim.next, {
      terrainState: moveAnim.prev,
      skipCrates,
      skipTarnish,
      skipHeroes: true,
      suppressMessages: true,
    });

    const { t, cell } = layout;

    // Moving crates
    for (const ev of moveAnim.ev) {
      if ((ev.type === 'push' || ev.type === 'fill') && ev.from !== undefined) {
        const [fx, fy] = cell(ev.world, ev.from);
        const [tx, ty] = cell(ev.world, ev.at);
        const x = (1 - tEase) * fx + tEase * tx;
        const y = (1 - tEase) * fy + tEase * ty;
        const isFill = ev.type === 'fill';
        const scale = isFill ? 1.0 - 0.4 * tEase : 1.0;
        const alpha = isFill ? Math.max(0, 1.0 - tEase) : 1.0;
        crateAt(g, x, y, t, scale, alpha);
      }
    }

    // Moving Tarnish
    for (const ev of moveAnim.ev) {
      if ((ev.type === 'foeStep' || ev.type === 'foeFall') && ev.from !== undefined) {
        const [fx, fy] = cell(ev.world, ev.from);
        const [tx, ty] = cell(ev.world, ev.at);
        const cx = (1 - tEase) * (fx + t / 2) + tEase * (tx + t / 2);
        const cy = (1 - tEase) * (fy + t / 2) + tEase * (ty + t / 2);
        const isFall = ev.type === 'foeFall';
        const scale = isFall ? 1.0 - 0.4 * tEase : 1.0;
        const alpha = isFall ? Math.max(0, 1.0 - tEase) : 1.0;
        tarnishAt(g, curScene, cx, cy, t, true, PAL[ev.world].ink, scale, alpha);
      }
    }

    // Sliding heroes
    for (const w of [0, 1] as W[]) {
      const [fx, fy] = cell(w, moveAnim.prev.pos[w]);
      const [tx, ty] = cell(w, moveAnim.next.pos[w]);
      const cx = (1 - tEase) * (fx + t / 2) + tEase * (tx + t / 2);
      const cy = (1 - tEase) * (fy + t / 2) + tEase * (ty + t / 2);
      heroAt(g, w, cx, cy, t, false);
    }

    drawFlipOverlay(g, curScene, layout);
  }

  window.__game = {
    levelIndex: () => index,
    levelCount: () => levels.length,
    loadLevel: load,
    press,
    state: () => hist.state,
    idle: () => queue.length === 0 && !moveAnim,
  };
  draw();
}
