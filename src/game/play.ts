// The play scene: one level. Owns the undo history, turns Actions into ticks, and tells the
// board, HUD and audio what happened. Game rules stay in the engine.
import { Container, Graphics } from 'pixi.js';
import { audio, type SfxName } from '../audio/audio';
import type { Ctx } from '../app/context';
import { recordSolve, stars } from '../app/save';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { History } from '../engine/history';
import { gateJammed, gateOpen, isWon, light, occupied, tick, voidBridge } from '../engine/tick';
import { isGate, isPlate } from '../engine/parse';
import type { Dir, GameEvent, State, W } from '../engine/types';
import { Hinter } from '../hints/hints';
import { chapterOf } from '../levels';
import { Board } from '../render/board';
import { drawBackground } from '../render/sprites';
import { ease } from '../render/tween';
import { C, text } from '../ui/style';
import { Hud } from '../ui/hud';
import { createPause } from '../ui/pause';

/** The level being played, for automation (tools/screenshots.ts). */
export let activePlay: { index: number; state(): State; idle(): boolean } | null = null;
const SHOTS = new URLSearchParams(location.search).has('shots');

const MOVE: Partial<Record<Action, Dir>> = { up: 'up', down: 'down', left: 'left', right: 'right' };
/** Engine event -> sound. Bumps are quiet; the Tarnish and fills carry the drama. */
const SFX: Partial<Record<GameEvent['type'], SfxName>> = {
  bump: 'bump', push: 'push', fill: 'fill', fall: 'fall', caught: 'caught', foeStep: 'foeStep', foeFall: 'foeFall', stomp: 'seesaw', stompJam: 'gateJam', drop: 'fall', flow: 'water', raft: 'fill', altar: 'altar', crack: 'crack', mirror: 'mirror',
};

export function createPlay(ctx: Ctx, index: number): Scene {
  const lv = ctx.levels[index];
  const root = new Container(), back = new Container(), wipe = new Graphics();
  const hist = new History(lv.start);
  const board = new Board(ctx.art, lv, lv.start, { reducedMotion: ctx.settings().reducedMotion, highContrast: ctx.settings().highContrast });
  const hud = new Hud(ctx, { undo: () => act('undo'), restart: () => act('restart'), hint: () => act('hint'), menu: () => act('menu') });
  const hinter = new Hinter();
  root.addChild(back, board, hud, wipe);

  const queue: Action[] = [];
  let busy = false;            // level-complete sequence or wipe running: ignore input
  let idle = 0, hintTier = 0, rewindTo = 0, demoShown = false;
  let vw = 0, vh = 0;

  const refreshHud = () => hud.set({ id: lv.id, name: lv.name, moves: hist.moves, par: lv.par });

  function layout(w: number, h: number) {
    vw = w; vh = h;
    back.removeChildren().forEach((c) => c.destroy());
    drawBackground(ctx.art, back, w, h, w / 2, chapterOf(lv));
    hud.layout(w, h);
    const top = Hud.heightFor(w), m = 16;
    const { t, landscape } = Board.fit(lv, w - 2 * m, h - top - 2 * m);
    board.layout(t, landscape);
    board.position.set(w / 2, top + (h - top) / 2);
  }

  function act(a: Action) { queue.push(a); }

  function step(dir: Dir) {
    const prev = hist.state;
    if (prev.fallen[0] || prev.fallen[1] || isWon(prev)) return;
    const ev: GameEvent[] = [];
    const next = tick(lv, prev, dir, ev);
    hist.push(next);
    board.animate(prev, next, ev, dir);
    sounds(prev, next, ev);
    hintTier = Math.min(hintTier, 2);
    refreshHud();
    if (next.fallen[0] || next.fallen[1]) {
      const caught = ev.some((e) => e.type === 'caught');
      hud.prompt(caught ? 'Caught! Undo to try again.' : 'A long way down… Undo to try again.');
    } else hud.prompt(null);
    if (isWon(next)) complete();
  }

  function sounds(prev: State, next: State, ev: GameEvent[]) {
    for (const w of [0, 1] as W[]) if (next.pos[w] !== prev.pos[w]) audio.sfx('step', w);
    const played = new Set<string>();
    for (const e of ev) {
      const name = e.type === 'flip' ? 'flip' : SFX[e.type];
      const key = `${name}:${e.type === 'flip' ? '' : e.world}`;
      if (!name || played.has(key)) continue;
      played.add(key);
      audio.sfx(name, e.type === 'flip' ? undefined : e.world);
    }
    // Gates: one sound per world that changed, so the cross-world cause is heard on both sides.
    for (const w of [0, 1] as W[]) {
      let opened = false, closed = false, jammed = false, down = false, up = false;
      for (let i = 0; i < next.tiles[w].length; i++) {
        const c = next.tiles[w][i];
        if (isPlate(c)) {
          const a = occupied(prev, w, i), b = occupied(next, w, i);
          down ||= !a && b; up ||= a && !b;
        }
        if (!isGate(c)) continue;
        const a = gateOpen(lv, prev, w, i), b = gateOpen(lv, next, w, i);
        opened ||= !a && b; closed ||= a && !b;
        jammed ||= gateJammed(lv, next, w, i) && !gateJammed(lv, prev, w, i);
      }
      if (down) audio.sfx('plateDown', w);
      if (up) audio.sfx('plateUp', w);
      if (opened) audio.sfx('gateOpen', w);
      if (closed) audio.sfx('gateClose', w);
      if (jammed) audio.sfx('gateJam', w);
    }
    // Bridges forming or melting as the light moves (Chapter 3).
    if (/[=-]/.test(lv.start.tiles[0] + lv.start.tiles[1])) {
      const [a, b] = [light(lv, prev), light(lv, next)];
      for (const w of [0, 1] as W[]) {
        let on = false, off = false;
        for (let i = 0; i < a[w].length; i++) {
          const c = next.tiles[w][i];
          if (c !== '=' && c !== '-') continue;
          const was = !voidBridge(c, a[w][i]), is = !voidBridge(c, b[w][i]);
          on ||= is && !was; off ||= was && !is;
        }
        if (on) audio.sfx('bridgeOn', w);
        if (off) audio.sfx('bridgeOff', w);
      }
    }
    const aligned = next.pos[0] === next.pos[1];
    if (aligned && prev.pos[0] !== prev.pos[1] && !ev.some((e) => e.type === 'flip')) audio.sfx('align');
    audio.setAligned(aligned);
  }

  /** Undo plays a quick reverse shimmer (SPEC §5.6). */
  function undo() {
    if (!hist.undo()) return;
    audio.sfx('undo');
    board.rebuild(hist.state);
    refreshHud();
    hud.prompt(null);
    board.tweens.add(0.22, (k) => (board.tint = k < 0.33 ? 0xe07a6b : k < 0.66 ? 0x9cd4e0 : 0xffffff));
  }

  /** Restart is a fast coin-spin wipe. */
  async function restart() {
    if (hist.state === lv.start) return;
    busy = true;
    audio.sfx('restart');
    const r = Math.hypot(vw, vh) / 2 + 20;
    // A gold coin grows over the screen while spinning a full turn, then shrinks away.
    const coin = (k: number) => wipe.clear().circle(0, 0, r * k).fill(C.gold).stroke({ width: 6, color: C.ink })
      .circle(0, 0, r * k * 0.9).stroke({ width: 3, color: C.goldDark });
    wipe.position.set(vw / 2, vh / 2);
    await board.tweens.add(0.2, (k) => { coin(k); wipe.scale.x = Math.cos(k * Math.PI); }, { ease: ease.inQuad });
    hist.restart();
    board.rebuild(hist.state);
    refreshHud();
    hud.prompt(null);
    await board.tweens.add(0.2, (k) => { coin(1 - k); wipe.scale.x = Math.cos(Math.PI + k * Math.PI); }, { ease: ease.outQuad });
    wipe.clear();
    wipe.scale.x = 1;
    busy = false;
  }

  async function hint() {
    idle = 0;
    audio.sfx('hint');
    if (rewindTo > 0) {
      for (let k = 0; k < rewindTo; k++) hist.undo();
      rewindTo = 0;
      board.rebuild(hist.state);
      refreshHud();
    }
    hintTier = Math.min(hintTier + 1, 3);
    const line = lv.hints[hintTier - 1];
    if (hintTier < 3 && line) return hud.prompt(line);
    hud.prompt('Thinking…');
    const res = await hinter.ask(lv.id, hist.past());
    if (res.back === 0) { showPath(res.path); hud.prompt('Follow the footprints.'); }
    else if (res.back > 0) { rewindTo = res.back; hud.prompt(`No way forward from here. Press hint again to rewind ${res.back} move${res.back > 1 ? 's' : ''}.`); }
    else hud.prompt('Even the coin is stumped. Try a restart.');
  }

  /** Ghost footprints for the next three moves. */
  function showPath(path: Dir[]) {
    const states: State[] = [];
    let s = hist.state;
    for (const d of path.slice(0, 3)) states.push((s = tick(lv, s, d)));
    board.showGhosts(states);
  }

  async function complete() {
    busy = true;
    const moves = hist.moves;
    ctx.save = recordSolve(ctx.save, lv.id, moves);
    ctx.persist();
    audio.sfx('levelComplete');
    audio.resolve();
    await board.tweens.wait(0.9);
    await board.close();
    board.shake(0.12);
    // Result card under the HUD, so the celebration on the board stays visible.
    const n = stars(lv.par, ctx.save.best[lv.id]);
    const card = new Container();
    const cy = Hud.heightFor(vw) + 64;
    const plate = new Graphics().roundRect(vw / 2 - 190, cy - 48, 380, 96, 18).fill({ color: C.inkNight, alpha: 0.85 }).stroke({ width: 2, color: C.gold });
    const coins = new Graphics();
    for (let k = 0; k < 3; k++) {
      const x = vw / 2 + (k - 1) * 34, y = cy - 16, earned = k < n;
      coins.circle(x, y, 12).fill(earned ? C.gold : 0x1c2046).stroke({ width: 2, color: earned ? C.goldDark : C.silverDark });
      coins.circle(x, y, 8.5).stroke({ width: 1, color: earned ? C.goldLight : C.silverDark, alpha: 0.8 });
    }
    const sub = text(`${moves} moves · par ${lv.par ?? '–'}${n === 3 ? ' · Perfect Coin' : ''}`, 22, C.goldLight);
    sub.anchor.set(0.5);
    sub.position.set(vw / 2, cy + 22);
    card.addChild(plate, coins, sub);
    root.addChild(card);
    await board.tweens.wait(1.5);
    if (SHOTS) { busy = false; return; } // screenshots want the solved board, not the next level
    // The coin flips (scale-X) into whatever comes next.
    await board.tweens.add(0.28, (k) => { board.scale.x = 1 - k; card.alpha = 1 - k; }, { ease: ease.inQuad });
    const next = index + 1;
    if (next >= ctx.levels.length || chapterOf(ctx.levels[next]) !== chapterOf(lv)) {
      audio.sfx('chapterComplete');
      ctx.go.album(chapterOf(lv));
    } else ctx.go.play(next);
  }

  function pause() {
    ctx.scenes.push(createPause(ctx, index, {
      resume: () => { ctx.scenes.pop(); board.opts = { reducedMotion: ctx.settings().reducedMotion, highContrast: ctx.settings().highContrast }; },
      restart: () => { ctx.scenes.pop(); restart(); },
      hint: () => { ctx.scenes.pop(); hint(); },
    }));
  }

  function handle(a: Action) {
    idle = 0;
    const dir = MOVE[a];
    if (dir) return step(dir);
    if (a === 'undo') return undo();
    if (a === 'restart') return void restart();
    if (a === 'hint') return void hint();
    if (a === 'menu') return pause();
    if (a === 'confirm' && rewindTo > 0) return void hint();
  }

  return {
    root,
    enter() {
      activePlay = { index, state: () => hist.state, idle: () => !busy && queue.length === 0 && !board.tweens.busy };
      board.rebuild(hist.state);
      refreshHud();
      audio.playMusic(chapterOf(lv));
    },
    exit() {
      hinter.destroy();
      activePlay = null;
      board.puppets.forEach((p) => p.removeFromParent()); // shared across levels: never destroy them with the scene
    },
    resize: layout,
    onAction(a) { if (!busy) queue.push(a); return true; },
    update(dt) {
      board.update(dt);
      // One buffered action per finished step, so fast typing never drops moves but stays readable.
      if (!busy && queue.length && !board.tweens.busy) handle(queue.shift()!);
      else if (!busy && queue.length > 3) { board.tweens.finish(); }
      idle += dt;
      const fresh = hist.moves === 0;
      // Teaching without text: the very first level demos its first moves as ghost footprints.
      if (index === 0 && fresh && idle > 3 && !demoShown) { demoShown = true; hinter.ask(lv.id, [hist.state]).then((r) => showPath(r.path)); }
      if (index < 2 && fresh && idle > 5 && idle - dt <= 5) hud.prompt(ctx.input.lastDevice === 'touch' ? 'Swipe to move both' : 'Arrow keys move both at once');
      const hintAfter = ctx.settings().judgeMode ? 20 : 40;
      if (idle > hintAfter && idle - dt <= hintAfter && hintTier === 0) hud.prompt(ctx.input.lastDevice === 'gamepad' ? 'Press X for a hint' : 'Press H for a hint');
    },
  };
}
