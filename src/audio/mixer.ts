import * as Tone from 'tone';

/**
 * Converts a linear volume [0..1] to decibels.
 * 0 maps to -Infinity dB to ensure absolute silence, while 1 maps to 0 dBFS.
 */
export function linearToDb(v: number): number {
  if (v <= 0.0001) return -Infinity;
  return 20 * Math.log10(v);
}

// Gain staging, measured in the browser: synths + velocities sit ~30 dB down, so these trims bring
// music peaks to about -18 dBFS and SFX to about -20 dBFS, with the limiter guarding the top.
const MUSIC_TRIM = 8, SFX_TRIM = 12, MASTER_TRIM = 6;

export interface VolumeSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export interface Stems {
  heads?: Tone.Player;
  tails?: Tone.Player;
  unison?: Tone.Player;
}

/**
 * Mixer manages the routing hierarchy:
 * Music layers (heads, tails, unison) -> Music Bus -> Master Bus
 * SFX Bus -> Master Bus
 * Master Bus -> Shared Reverb -> Master Limiter -> Audio Destination
 */
export class Mixer {
  readonly headsChannel: Tone.Channel;
  readonly tailsChannel: Tone.Channel;
  readonly unisonChannel: Tone.Channel;

  readonly musicBus: Tone.Channel;
  readonly sfxBus: Tone.Channel;
  readonly masterBus: Tone.Channel;

  readonly sharedReverb: Tone.Reverb;
  readonly limiter: Tone.Limiter;

  private activeStems: Stems | null = null;
  private stemsChecked = false;

  constructor() {
    // Music layer channels: Heads is warm (-12 dB), Tails is glassy (-13 dB), Unison starts silent
    this.headsChannel = new Tone.Channel({ volume: -4 });
    this.tailsChannel = new Tone.Channel({ volume: -5 });
    this.unisonChannel = new Tone.Channel({ volume: -60 });

    // Submix buses
    this.musicBus = new Tone.Channel({ volume: this.musicLevelDb });
    this.sfxBus = new Tone.Channel({ volume: SFX_TRIM });
    this.masterBus = new Tone.Channel({ volume: MASTER_TRIM });

    // Master acoustic cohesion & safety limiter
    this.sharedReverb = new Tone.Reverb({
      decay: 1.8,
      preDelay: 0.015,
      wet: 0.12,
    });
    this.limiter = new Tone.Limiter(-0.5);

    // Wire music layer channels to music submix
    this.headsChannel.connect(this.musicBus);
    this.tailsChannel.connect(this.musicBus);
    this.unisonChannel.connect(this.musicBus);

    // Wire submixes into master bus
    this.musicBus.connect(this.masterBus);
    this.sfxBus.connect(this.masterBus);

    // Master bus routes through subtle ambient reverb and peak limiter to speaker destination
    this.masterBus.connect(this.sharedReverb);
    this.sharedReverb.connect(this.limiter);
    this.limiter.toDestination();
  }

  /**
   * Applies user volume settings in linear 0..1 scale.
   * Mute acts as master mute to silence all audio outputs immediately.
   */
  /** The music bus level the player chose; fades and restarts return here. */
  musicLevelDb = linearToDb(0.7) + MUSIC_TRIM;

  setVolumes(v: VolumeSettings): void {
    this.masterBus.volume.value = linearToDb(v.master) + MASTER_TRIM;
    this.musicLevelDb = linearToDb(v.music) + MUSIC_TRIM;
    this.musicBus.volume.value = this.musicLevelDb;
    this.sfxBus.volume.value = linearToDb(v.sfx) + SFX_TRIM;
    this.masterBus.mute = v.muted;
  }

  /**
   * Smoothly crossfades the Unison choir layer in or out over ~1.5 seconds.
   * When characters align on twin coordinates, unison fades in to -10 dB.
   */
  setAligned(aligned: boolean): void {
    const targetDb = aligned ? -4 : -60;
    this.unisonChannel.volume.rampTo(targetDb, 1.5);
  }

  /**
   * SPEC §6.1 stem replacement hook:
   * Checks /manifest.json for pre-recorded stem audio keys. If available, plays
   * them via synced Tone.Player instances instead of the code-generated synths.
   */
  async loadStemsIfAvailable(): Promise<Stems | null> {
    if (this.stemsChecked) return this.activeStems;
    this.stemsChecked = true;

    try {
      if (typeof fetch === 'undefined') return null;
      const res = await fetch(`${import.meta.env.BASE_URL}manifest.json`);
      if (!res.ok) return null;

      const manifest = (await res.json()) as Record<string, { src?: string }>;
      const headsSrc = manifest['audio/ch1/heads']?.src;
      const tailsSrc = manifest['audio/ch1/tails']?.src;
      const unisonSrc = manifest['audio/ch1/unison']?.src;

      if (!headsSrc || !tailsSrc) return null;

      // Manifest paths are relative to the site root, which may be a subfolder (itch.io).
      const normalizePath = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

      const headsPlayer = new Tone.Player({
        url: normalizePath(headsSrc),
        loop: true,
      }).sync();
      headsPlayer.connect(this.headsChannel);

      const tailsPlayer = new Tone.Player({
        url: normalizePath(tailsSrc),
        loop: true,
      }).sync();
      tailsPlayer.connect(this.tailsChannel);

      let unisonPlayer: Tone.Player | undefined;
      if (unisonSrc) {
        unisonPlayer = new Tone.Player({
          url: normalizePath(unisonSrc),
          loop: true,
        }).sync();
        unisonPlayer.connect(this.unisonChannel);
      }

      this.activeStems = {
        heads: headsPlayer,
        tails: tailsPlayer,
        unison: unisonPlayer,
      };

      return this.activeStems;
    } catch {
      // Manifest not present or network unavailable: fall back to synthesized layers
      return null;
    }
  }

  getStems(): Stems | null {
    return this.activeStems;
  }
}
