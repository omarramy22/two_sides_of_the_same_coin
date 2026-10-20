// src/ui/title.ts: Title screen with well background, spinning logo coin, Sol & Lune puppets on the rim.
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { audio } from '../audio/audio';
import { loadPuppet, texture, type Puppet } from '../render/rig';
import { createCredits } from './credits';
import { Button, C, FocusList, text } from './style';

export function createTitle(ctx: Ctx): Scene {
  const root = new Container();
  root.eventMode = 'static';

  let curW = window.innerWidth;
  let curH = window.innerHeight;

  // Background well image
  const bg = new Sprite();
  bg.anchor.set(0.5);
  root.addChild(bg);
  texture('title/well')
    .then((t) => {
      bg.texture = t;
      layout(curW, curH);
    })
    .catch(() => {});

  // Logo coin and textures
  let logoFrontTex: Texture | null = null;
  let logoBackTex: Texture | null = null;
  const logoSprite = new Sprite();
  logoSprite.anchor.set(0.5);
  root.addChild(logoSprite);

  texture('title/logo')
    .then((t) => {
      logoFrontTex = t;
      logoSprite.texture = t;
    })
    .catch(() => {});

  texture('title/logo-back')
    .then((t) => {
      logoBackTex = t;
    })
    .catch(() => {});

  // Characters standing on the rim
  let solPuppet: Puppet | null = null;
  let lunePuppet: Puppet | null = null;
  const puppetLayer = new Container();
  root.addChild(puppetLayer);

  loadPuppet('sol')
    .then((p) => {
      solPuppet = p;
      p.facing = 1;
      p.partnerSide = 1;
      puppetLayer.addChild(p);
      layout(curW, curH);
    })
    .catch(() => {});

  loadPuppet('lune')
    .then((p) => {
      lunePuppet = p;
      p.facing = -1;
      p.partnerSide = -1;
      puppetLayer.addChild(p);
      layout(curW, curH);
    })
    .catch(() => {});

  // Navigation buttons
  const firstUnsolved = ctx.levels.findIndex((lv) => ctx.save.best[lv.id] === undefined);
  const playIndex = firstUnsolved >= 0 ? firstUnsolved : 0;

  const playBtn = new Button('Play', () => ctx.go.play(playIndex), 220, 56, 28);
  const albumBtn = new Button('Level album', () => ctx.go.album(), 180, 44, 20);
  root.addChild(playBtn, albumBtn);

  const focus = new FocusList([playBtn, albumBtn]);

  // Corner text buttons: Settings (bottom-left) and Credits (bottom-right)
  const settingsBtn = new Container();
  const settingsText = text('SETTINGS', 18, C.goldDark);
  const settingsGlow = new Graphics();
  settingsBtn.addChild(settingsGlow, settingsText);
  settingsBtn.eventMode = 'static';
  settingsBtn.cursor = 'pointer';
  settingsBtn.on('pointerover', () => {
    settingsText.style.fill = C.goldLight;
    audio.sfx('uiHover');
  });
  settingsBtn.on('pointerout', () => {
    settingsText.style.fill = C.goldDark;
  });
  settingsBtn.on('pointertap', () => {
    audio.sfx('uiClick');
    ctx.go.settings();
  });

  const creditsBtn = new Container();
  const creditsText = text('CREDITS', 18, C.silverDark);
  const creditsGlow = new Graphics();
  creditsBtn.addChild(creditsGlow, creditsText);
  creditsBtn.eventMode = 'static';
  creditsBtn.cursor = 'pointer';
  creditsBtn.on('pointerover', () => {
    creditsText.style.fill = C.silverLight;
    audio.sfx('uiHover');
  });
  creditsBtn.on('pointerout', () => {
    creditsText.style.fill = C.silverDark;
  });
  creditsBtn.on('pointertap', () => {
    audio.sfx('uiClick');
    ctx.scenes.push(createCredits(ctx, () => ctx.scenes.pop()));
  });

  root.addChild(settingsBtn, creditsBtn);

  // Audio unlock on very first pointerdown or keydown anywhere
  let audioUnlocked = false;
  const unlockAudio = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    audio.unlock().then(() => audio.playMusic(1)).catch(() => {});
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  let time = 0;
  let targetLogoW = 280;
  let logoBaseY = 220;

  function layout(w: number, h: number) {
    curW = w;
    curH = h;

    // Background well covers the window
    if (bg.texture && bg.texture.width > 0) {
      const scaleBg = Math.max(w / bg.texture.width, h / bg.texture.height);
      bg.scale.set(scaleBg);
      bg.position.set(w / 2, h / 2);
    } else {
      bg.position.set(w / 2, h / 2);
    }

    // Logo sizing and positioning in the upper half
    targetLogoW = Math.min(0.42 * h, 0.5 * w, 320);
    logoBaseY = Math.max(targetLogoW / 2 + 16, h * 0.28);
    logoSprite.position.set(w / 2, logoBaseY);

    // Characters standing on the rim facing each other
    const k = Math.max(w / 1280, h / 720);
    const puppetScale = Math.min(1.6 * (h / 720), 1.6);

    if (solPuppet) {
      solPuppet.scale.set(puppetScale);
      // In 1280x720 mock: Sol cx ~ 185, cy ~ 372
      const solX = Math.max(36, Math.min(w / 2 - targetLogoW / 2 - 30, w / 2 - 455 * k));
      const solY = Math.min(h - 80, Math.max(h * 0.45, h / 2 + 12 * k));
      solPuppet.position.set(solX, solY);
    }

    if (lunePuppet) {
      lunePuppet.scale.set(puppetScale);
      // In 1280x720 mock: Lune cx ~ 1095, cy ~ 372
      const luneX = Math.min(w - 36, Math.max(w / 2 + targetLogoW / 2 + 30, w / 2 + 455 * k));
      const luneY = Math.min(h - 80, Math.max(h * 0.45, h / 2 + 12 * k));
      lunePuppet.position.set(luneX, luneY);
    }

    // Play button under logo
    const playY = Math.min(h - 150, Math.max(logoBaseY + targetLogoW / 2 + 28, h * 0.62));
    playBtn.position.set(w / 2 - playBtn.w / 2, playY);

    // Album button under Play
    const albumY = playY + playBtn.h + 16;
    albumBtn.position.set(w / 2 - albumBtn.w / 2, albumY);

    // Settings (bottom-left) and Credits (bottom-right)
    settingsBtn.position.set(24, h - 36);
    creditsBtn.position.set(w - creditsText.width - 24, h - 36);
  }

  return {
    root,
    enter() {
      layout(window.innerWidth, window.innerHeight);
    },
    exit() {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    },
    update(dt: number) {
      time += dt;

      // Logo coin spin logic: every ~9 s does one full turn over ~1.6 s
      const cycle = time % 9.0;
      const baseScale = targetLogoW / 320;

      if (cycle < 1.6) {
        const angle = (cycle / 1.6) * Math.PI * 2;
        const c = Math.cos(angle);
        if (c >= 0) {
          if (logoFrontTex) logoSprite.texture = logoFrontTex;
          logoSprite.scale.set(c * baseScale, baseScale);
        } else {
          if (logoBackTex) logoSprite.texture = logoBackTex;
          logoSprite.scale.set(-c * baseScale, baseScale);
        }
        logoSprite.y = logoBaseY;
      } else {
        if (logoFrontTex) logoSprite.texture = logoFrontTex;
        logoSprite.scale.set(baseScale, baseScale);
        logoSprite.y = logoBaseY + Math.sin((time - 1.6) * 2.2) * 5;
      }

      if (solPuppet) solPuppet.update(dt);
      if (lunePuppet) lunePuppet.update(dt);
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
    onAction(a: Action) {
      if (focus.action(a)) return true;
      if (a === 'left') {
        audio.sfx('uiClick');
        ctx.go.settings();
        return true;
      }
      if (a === 'right') {
        audio.sfx('uiClick');
        ctx.scenes.push(createCredits(ctx, () => ctx.scenes.pop()));
        return true;
      }
      return false;
    },
  };
}
