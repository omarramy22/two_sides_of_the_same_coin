// Phase 1 greybox: flat shapes drawn straight from the engine State. No game rules here.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { History } from '../engine/history';
import { isGate, isPlate, parseLevel } from '../engine/parse';
import { gateJammed, gateOpen, isWon, tick } from '../engine/tick';
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
        g.rect(x, y, t, t).fill(c === '#' ? p.wall : p.floor);
        if (c === 'G') g.rect(x + t * 0.1, y + t * 0.1, t * 0.8, t * 0.8).fill(p.goal);
        else if (c === '^') g.rect(x + t * 0.05, y + t * 0.05, t * 0.9, t * 0.9).fill(p.pit);
        else if (isPlate(c)) {
          g.rect(x + t * 0.2, y + t * 0.2, t * 0.6, t * 0.6).fill(0x9c8cd4);
          label(c, x, y, 0x1c2046);
        } else if (isGate(c)) {
          if (gateOpen(lv, s, w, i)) {
            g.rect(x + 2, y + 2, t - 4, t - 4).stroke({ width: gateJammed(lv, s, w, i) ? 5 : 2, color: gateJammed(lv, s, w, i) ? 0xe07a6b : 0x4a5a8c });
          } else g.rect(x, y, t, t).fill(0x4a5a8c);
          label(c, x, y, p.ink);
        } else if (c === '/') g.moveTo(x + t * 0.15, y + t * 0.85).lineTo(x + t * 0.85, y + t * 0.15).stroke({ width: 2, color: p.ink });
        else if (c === '|') {
          g.rect(x, y, t, t).fill(0x6b5b3a);
          g.moveTo(x + t * 0.15, y + t * 0.85).lineTo(x + t * 0.85, y + t * 0.15).stroke({ width: 6, color: 0x2a1e14 });
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
