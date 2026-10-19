// Phase 1 greybox: flat shapes drawn straight from the engine State. No game rules here.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { History } from '../engine/history';
import { isGate, isPlate, parseLevel } from '../engine/parse';
import { foeIntents, gateJammed, gateOpen, isWon, tick } from '../engine/tick';
import type { Dir, Level, LevelFile, W } from '../engine/types';

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

declare global { interface Window { __game: unknown } }

export function startGreybox(app: Application) {
  let index = 0, lv = levels[0], hist = new History(lv.start);
  let scene = new Container();
  const queue: string[] = [];

  function load(i: number) {
    index = (i + levels.length) % levels.length;
    lv = levels[index];
    hist = new History(lv.start);
    draw();
  }

  function handle(key: string) {
    const dir = MOVES[key];
    if (dir) hist.push(tick(lv, hist.state, dir));
    else if (key === 'z' || key === 'Backspace') hist.undo();
    else if (key === 'r') hist.restart();
    else if (key === 'n') return load(index + 1);
    else if (key === 'p') return load(index - 1);
    else if (key === 'Enter' && isWon(hist.state)) return load(index + 1);
    draw();
  }

  const press = (raw: string) => {
    const key = raw.length === 1 ? raw.toLowerCase() : raw;
    if (key in MOVES || OTHER_KEYS.includes(key)) { queue.push(key); return true; }
    return false;
  };
  window.addEventListener('keydown', (e) => { if (press(e.key)) e.preventDefault(); });
  // One buffered key per frame, so fast typing never drops moves.
  app.ticker.add(() => { const k = queue.shift(); if (k) handle(k); });
  window.addEventListener('resize', draw);

  function draw() {
    scene.destroy({ children: true });
    scene = new Container();
    app.stage.addChild(scene);
    const s = hist.state;
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
    const g = new Graphics();
    scene.addChild(g);
    const label = (text: string, x: number, y: number, fill: number) => {
      const txt = new Text({ text, style: { fill, fontSize: Math.round(t * 0.4), fontFamily: 'sans-serif', fontWeight: 'bold' } });
      txt.anchor.set(0.5);
      txt.position.set(x + t / 2, y + t / 2);
      scene.addChild(txt);
    };

    // Seam between the worlds.
    if (landscape) g.rect(ox + lv.w * t, oy, SEAM * t, lv.h * t).fill(0xb8a47a);
    else g.rect(ox, oy + lv.h * t, lv.w * t, SEAM * t).fill(0xb8a47a);

    for (const w of [0, 1] as W[]) {
      const p = PAL[w];
      for (let i = 0; i < lv.w * lv.h; i++) {
        const [x, y] = cell(w, i), c = s.tiles[w][i];
        const cx = x + t / 2;
        g.rect(x, y, t, t).fill(c === '#' ? p.wall : c === '|' ? 0x6b5b3a : p.floor);
        if (c === 'G') g.rect(x + t * 0.1, y + t * 0.1, t * 0.8, t * 0.8).fill(p.goal);
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
          if (gateOpen(lv, s, w, i)) {
            g.rect(x + 2, y + 2, t - 4, t - 4).stroke({ width: gateJammed(lv, s, w, i) ? 5 : 2, color: gateJammed(lv, s, w, i) ? 0xe07a6b : 0x4a5a8c });
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
        if (s.objs[w][i] === 'C') g.rect(x + t * 0.15, y + t * 0.15, t * 0.7, t * 0.7).fill(0xc8643b).stroke({ width: 2, color: 0x2a1e14 });
      }

      for (let i = 0; i < lv.w * lv.h; i++) {
        const obj = s.objs[w][i];
        if (obj !== '@' && obj !== '?') continue;
        const [x, y] = cell(w, i);
        const cx = x + t / 2, cy = y + t / 2, r = t * 0.3;
        const awake = obj === '@';
        const fill = awake ? 0xb5543a : { color: 0x7d6b55, alpha: 0.85 };
        const outline = { width: 2, color: 0x2a1e14 };

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
          const eyeR = Math.max(1.5, t * 0.04);
          g.circle(cx - r * 0.35, cy - r * 0.05, eyeR).fill(0xffe08a);
          g.circle(cx + r * 0.35, cy - r * 0.05, eyeR).fill(0xffe08a);
        } else {
          g.moveTo(cx - r * 0.5, cy - r * 0.05).lineTo(cx - r * 0.2, cy - r * 0.05).stroke(outline);
          g.moveTo(cx + r * 0.2, cy - r * 0.05).lineTo(cx + r * 0.5, cy - r * 0.05).stroke(outline);

          const zTxt = new Text({
            text: 'z',
            style: { fill: p.ink, fontSize: Math.max(8, Math.round(t * 0.28)), fontFamily: 'sans-serif', fontWeight: 'bold' },
          });
          zTxt.anchor.set(0.5);
          zTxt.position.set(cx + r * 0.75, cy - r * 0.75);
          scene.addChild(zTxt);
        }
      }

      const [hx, hy] = cell(w, s.pos[w]);
      g.circle(hx + t / 2, hy + t / 2, t * 0.32).fill(s.fallen[w] ? 0x777777 : p.hero).stroke({ width: 2, color: p.ink });
    }

    // Alignment thread across the seam.
    if (s.pos[0] === s.pos[1]) {
      const [ax, ay] = cell(0, s.pos[0]), [bx, by] = cell(1, s.pos[1]);
      g.moveTo(ax + t / 2, ay + t / 2).lineTo(bx + t / 2, by + t / 2).stroke({ width: 3, color: 0xfff4d6, alpha: 0.9 });
    }

    // Enemy intent arrows (on top of all tiles/objects/characters of both worlds).
    for (const intent of foeIntents(lv, s)) {
      if (intent.to < 0) continue;
      const [fx, fy] = cell(intent.world, intent.from);
      const [tx, ty] = cell(intent.world, intent.to);
      const cx = fx + t / 2, cy = fy + t / 2;
      const tcx = tx + t / 2, tcy = ty + t / 2;
      const dx = tcx - cx, dy = tcy - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const nx = -uy, ny = ux;

      const sx = cx + ux * 0.3 * t, sy = cy + uy * 0.3 * t;
      const ex = cx + ux * 0.85 * t, ey = cy + uy * 0.85 * t;
      g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: 0.08 * t, color: 0xe07a6b, alpha: 0.9 });

      const tipX = cx + ux * 0.98 * t, tipY = cy + uy * 0.98 * t;
      const baseX = cx + ux * 0.84 * t, baseY = cy + uy * 0.84 * t;
      const hw = 0.08 * t;
      g.poly([
        tipX, tipY,
        baseX + nx * hw, baseY + ny * hw,
        baseX - nx * hw, baseY - ny * hw,
      ], true).fill({ color: 0xe07a6b, alpha: 0.9 });
    }

    const hud = new Text({
      text: `${lv.id} ${lv.name}  ·  moves ${hist.moves}  ·  par ${lv.par ?? '-'}`,
      style: { fill: 0xe8f0ff, fontSize: 22, fontFamily: 'sans-serif' },
    });
    hud.position.set(MARGIN, (HUD - 22) / 2 + MARGIN / 2);
    scene.addChild(hud);

    const caught = (s.fallen[0] && s.objs[0][s.pos[0]] === '@') || (s.fallen[1] && s.objs[1][s.pos[1]] === '@');
    const msg = isWon(s) ? `Solved in ${hist.moves} moves. Enter for next level`
      : caught ? 'Caught! Press Z to undo or R to restart'
      : s.fallen[0] || s.fallen[1] ? 'Fell! Press Z to undo or R to restart' : '';
    if (msg) {
      const txt = new Text({ text: msg, style: { fill: 0xffffff, fontSize: 26, fontFamily: 'sans-serif' } });
      txt.anchor.set(0.5);
      txt.position.set(vw / 2, vh / 2);
      const back = new Graphics().roundRect(vw / 2 - txt.width / 2 - 20, vh / 2 - 30, txt.width + 40, 60, 10).fill({ color: 0x000000, alpha: 0.7 });
      scene.addChild(back, txt);
    }
  }

  window.__game = {
    levelIndex: () => index,
    levelCount: () => levels.length,
    loadLevel: load,
    press,
    state: () => hist.state,
    idle: () => queue.length === 0,
  };
  draw();
}
