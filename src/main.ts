import '@fontsource/im-fell-english/400.css';
import { Application } from 'pixi.js';
import { audio } from './audio/audio';
import type { Ctx } from './app/context';
import { loadSave, writeSave } from './app/save';
import { Scenes } from './app/scenes';
import type { Action, Settings } from './app/settings';
import { activePlay, createPlay } from './game/play';
import { Input } from './input/input';
import { levels } from './levels';
import { startDemo } from './render/demo';
import { loadArt } from './render/sprites';
import { createAlbum } from './ui/album';
import { createSettings } from './ui/settings';
import { createTitle } from './ui/title';

declare global { interface Window { __game: unknown } }
const params = new URLSearchParams(location.search);

async function boot() {
  const app = new Application();
  await app.init({ resizeTo: window, background: '#1C2046', antialias: true });
  document.body.appendChild(app.canvas);
  await document.fonts.load("32px 'IM Fell English'").catch(() => undefined);
  if (params.has('demo')) return startDemo(app);

  const scenes = new Scenes(app);
  const art = await loadArt();
  const applyAudio = (s: Settings) => audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
  const ctx: Ctx = {
    app, scenes, art, levels,
    save: loadSave(),
    input: undefined as unknown as Input,
    settings: () => ctx.save.settings,
    setSettings(s) { ctx.save = { ...ctx.save, settings: s }; applyAudio(s); ctx.persist(); },
    persist: () => writeSave(ctx.save),
    go: {
      title: () => scenes.show(createTitle(ctx)),
      album: (chapter = 1) => scenes.show(createAlbum(ctx, chapter)),
      play: (i) => scenes.show(createPlay(ctx, Math.max(0, Math.min(levels.length - 1, i)))),
      settings: () => scenes.push(createSettings(ctx, () => scenes.pop())),
    },
  };
  ctx.input = new Input(app.canvas, ctx.settings);
  applyAudio(ctx.settings());

  // Audio may only start after a user gesture (browser autoplay rules).
  const unlock = () => { audio.unlock().then(() => applyAudio(ctx.settings())); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  ctx.input.onAction((a) => { unlock(); scenes.action(a); });
  app.ticker.add((t) => ctx.input.update(t.deltaMS / 1000));

  // Automation hooks (tools/screenshots.ts).
  const keyAction = (key: string): Action | undefined => (Object.entries(ctx.settings().keys) as [Action, string[]][])
    .find(([, ks]) => ks.some((k) => k.toLowerCase() === key.toLowerCase()))?.[0];
  window.__game = {
    levelIndex: () => activePlay?.index ?? -1,
    levelCount: () => levels.length,
    loadLevel: (i: number) => scenes.show(createPlay(ctx, i), false),
    press: (key: string) => { const a = keyAction(key); if (a) scenes.action(a); return !!a; },
    state: () => activePlay?.state(),
    idle: () => activePlay?.idle() ?? true,
  };

  const start = params.get('level');
  const i = start ? levels.findIndex((l) => l.id === start) : -1;
  if (i >= 0) ctx.go.play(i);
  else if (params.has('shots')) ctx.go.play(0);
  else ctx.go.title();
}

boot();
