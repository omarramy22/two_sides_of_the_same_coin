import * as Tone from 'tone';
import { Mixer, type VolumeSettings } from './mixer';
import { Chapter1Theme } from './themes/ch1';
import { Chapter2Theme } from './themes/ch2';
import { SfxPool } from './sfx';

export type SfxName =
  | 'step' | 'push' | 'bump' | 'fill' | 'fall' | 'caught'
  | 'foeStep' | 'foeFall' | 'flip' | 'align'
  | 'plateDown' | 'plateUp' | 'gateOpen' | 'gateClose' | 'gateJam' | 'seesaw'
  | 'undo' | 'restart' | 'hint' | 'levelComplete' | 'chapterComplete'
  | 'uiHover' | 'uiClick';

class AudioManager {
  private _unlocked = false;
  private unlockPromise: Promise<void> | null = null;

  private mixer: Mixer | null = null;
  private ch1Theme: Chapter1Theme | null = null;
  private ch2Theme: Chapter2Theme | null = null;
  private currentTheme: Chapter1Theme | Chapter2Theme | null = null;
  private sfxPool: SfxPool | null = null;

  private pendingVolumes: VolumeSettings = {
    master: 0.8,
    music: 0.7,
    sfx: 0.8,
    muted: false,
  };

  get unlocked(): boolean {
    return this._unlocked;
  }

  /**
   * Unlocks the Web Audio context on the first user gesture.
   * Safe to call multiple times. All operations before unlock complete are no-ops.
   */
  async unlock(): Promise<void> {
    if (this._unlocked) return;
    if (this.unlockPromise) return this.unlockPromise;

    this.unlockPromise = (async () => {
      try {
        if (typeof window === 'undefined') return;

        // Start Tone.js audio context
        await Tone.start();

        // Initialize audio subsystem
        this.mixer = new Mixer();
        this.ch1Theme = new Chapter1Theme(this.mixer);
        this.ch2Theme = new Chapter2Theme(this.mixer);
        this.sfxPool = new SfxPool(this.mixer);

        // Apply any volume configuration requested prior to unlock
        this.mixer.setVolumes(this.pendingVolumes);

        // Await impulse response generation for the shared reverb
        try {
          await this.mixer.sharedReverb.ready;
        } catch {
          // Reverb falls back to dry/procedural if offline IR fails
        }

        this._unlocked = true;
      } catch {
        // Audio unavailable or blocked: remain gracefully disabled without throwing
        this._unlocked = false;
      }
    })();

    return this.unlockPromise;
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }): void {
    this.pendingVolumes = { ...v };
    if (!this._unlocked || !this.mixer) return;
    try {
      this.mixer.setVolumes(v);
    } catch {
      // Safe no-op
    }
  }

  playMusic(chapter: number): void {
    if (!this._unlocked || !this.ch1Theme || !this.ch2Theme) return;
    try {
      const target = chapter === 2 ? this.ch2Theme : this.ch1Theme;
      if (this.currentTheme === target) return;
      if (this.currentTheme) {
        this.currentTheme.stop(0.2);
        setTimeout(() => {
          if (this.currentTheme === target) {
            void target.start();
          }
        }, 300);
      } else {
        void target.start();
      }
      this.currentTheme = target;
    } catch {
      // Safe no-op
    }
  }

  stopMusic(fadeSec?: number): void {
    if (!this._unlocked) return;
    try {
      this.currentTheme?.stop(fadeSec);
      this.currentTheme = null;
    } catch {
      // Safe no-op
    }
  }

  setAligned(aligned: boolean): void {
    if (!this._unlocked || !this.mixer) return;
    try {
      this.mixer.setAligned(aligned);
    } catch {
      // Safe no-op
    }
  }

  resolve(): void {
    if (!this._unlocked) return;
    try {
      (this.currentTheme ?? this.ch1Theme)?.resolve();
    } catch {
      // Safe no-op
    }
  }

  sfx(name: SfxName, world?: 0 | 1): void {
    if (!this._unlocked || !this.sfxPool) return;
    try {
      this.sfxPool.play(name, world);
    } catch {
      // Safe no-op
    }
  }
}

export const audio: {
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }): void;
  playMusic(chapter: number): void;
  stopMusic(fadeSec?: number): void;
  setAligned(aligned: boolean): void;
  resolve(): void;
  sfx(name: SfxName, world?: 0 | 1): void;
} = new AudioManager();
