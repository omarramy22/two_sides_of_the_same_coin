import * as Tone from 'tone';
import type { Mixer } from './mixer';
import type { SfxName } from './audio';

export type { SfxName };

/**
 * Pre-allocated synth pool to prevent runtime node allocation and memory leaks.
 * Layered to ensure rich acoustic texture (noise transient + pitched body + resonance).
 */
export class SfxPool {
  private readonly warmNoise: Tone.NoiseSynth;
  private readonly crispNoise: Tone.NoiseSynth;
  private readonly warmMembrane: Tone.MembraneSynth;
  private readonly glassySynth: Tone.Synth;
  private readonly warmFm: Tone.FMSynth;
  private readonly bellFm: Tone.FMSynth;
  private readonly polyChime: Tone.PolySynth<Tone.Synth>;
  private readonly metalCoin: Tone.MetalSynth;

  // Throttling: same (sfx + world) triggered at most once every 30 ms
  private readonly lastTriggerTimes = new Map<string, number>();

  constructor(mixer: Mixer) {
    // 1. Warm noise for stone scrapes, wood friction, dull thud transients
    this.warmNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.002, decay: 0.06, sustain: 0 },
      volume: -9,
    });
    this.warmNoise.connect(mixer.sfxBus);

    // 2. Crisp noise for glassy transients, silver clicks, sparks
    this.crispNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -12,
    });
    this.crispNoise.connect(mixer.sfxBus);

    // 3. Warm membrane synth for low stone/wood footfalls, crate drop thunks
    this.warmMembrane = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 },
      volume: -8,
    });
    this.warmMembrane.connect(mixer.sfxBus);

    // 4. Glassy body synth for cool, lunar Tails responses
    this.glassySynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.003, decay: 0.14, sustain: 0, release: 0.1 },
      volume: -10,
    });
    this.glassySynth.connect(mixer.sfxBus);

    // 5. Warm FM synth for mallets, bells and Heads chimes
    this.warmFm = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.003, decay: 0.22, sustain: 0, release: 0.15 },
      volume: -8,
    });
    this.warmFm.connect(mixer.sfxBus);

    // 6. Glassy FM synth for crystalline celesta and Tails chimes
    this.bellFm = new Tone.FMSynth({
      harmonicity: 4.5,
      modulationIndex: 3.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.2 },
      volume: -9,
    });
    this.bellFm.connect(mixer.sfxBus);

    // 7. Polyphonic chime synth for arpeggios, coin spins, alignments
    this.polyChime = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.28, sustain: 0, release: 0.25 },
      volume: -10,
    });
    this.polyChime.connect(mixer.sfxBus);

    // 8. Metallic synth for coin clinks and coin spin zings
    this.metalCoin = new Tone.MetalSynth({
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 2600,
      octaves: 1.5,
      envelope: { attack: 0.001, decay: 0.12, release: 0.08 },
      volume: -14,
    });
    this.metalCoin.connect(mixer.sfxBus);
  }

  private isThrottled(name: SfxName, worldKey: string): boolean {
    const key = `${name}_${worldKey}`;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastTriggerTimes.get(key);
    if (last !== undefined && now - last < 30) {
      return true;
    }
    this.lastTriggerTimes.set(key, now);
    return false;
  }

  play(name: SfxName, world?: 0 | 1): void {
    const worldKey = world !== undefined ? String(world) : 'neutral';
    if (this.isThrottled(name, worldKey)) return;

    const now = Tone.now();
    const isTails = world === 1;

    switch (name) {
      case 'step': {
        if (!isTails) {
          // Heads: soft warm stone footfall
          this.warmMembrane.triggerAttackRelease('A1', '64n', now, 0.22);
          this.warmNoise.triggerAttackRelease('64n', now, 0.08);
        } else {
          // Tails: glassy stone footfall
          this.glassySynth.triggerAttackRelease('D4', '64n', now, 0.15);
          this.crispNoise.triggerAttackRelease('64n', now, 0.07);
        }
        break;
      }

      case 'push': {
        if (!isTails) {
          // Heads: warm wood scrape
          this.warmNoise.triggerAttackRelease('16n', now, 0.16);
          this.warmMembrane.triggerAttackRelease('D2', '32n', now, 0.1);
        } else {
          // Tails: glassy slate scrape
          this.crispNoise.triggerAttackRelease('16n', now, 0.14);
          this.glassySynth.triggerAttackRelease('A3', '32n', now, 0.08);
        }
        break;
      }

      case 'bump': {
        if (!isTails) {
          // Heads: dull thud + tiny wobble
          this.warmMembrane.triggerAttackRelease('G1', '16n', now, 0.3);
          this.warmFm.triggerAttackRelease('D2', '32n', now + 0.04, 0.12);
        } else {
          // Tails: hollow glassy thud + wobble
          this.glassySynth.triggerAttackRelease('E3', '16n', now, 0.22);
          this.bellFm.triggerAttackRelease('B3', '32n', now + 0.03, 0.12);
        }
        break;
      }

      case 'fill': {
        if (!isTails) {
          // Heads: crate thunk dropping into pit
          this.warmMembrane.triggerAttackRelease('C1', '8n', now, 0.38);
          this.warmNoise.triggerAttackRelease('32n', now, 0.18);
        } else {
          // Tails: hollow crate thunk
          this.warmMembrane.triggerAttackRelease('F1', '8n', now, 0.3);
          this.bellFm.triggerAttackRelease('F3', '16n', now, 0.18);
        }
        break;
      }

      case 'fall': {
        if (!isTails) {
          // Heads: warm descending whoosh
          this.warmNoise.triggerAttackRelease('8n', now, 0.2);
          this.warmMembrane.triggerAttackRelease('A1', '8n', now, 0.18);
        } else {
          // Tails: airy descending whoosh
          this.crispNoise.triggerAttackRelease('8n', now, 0.2);
          this.glassySynth.triggerAttackRelease('E4', '8n', now, 0.14);
        }
        break;
      }

      case 'caught': {
        if (!isTails) {
          // Heads: rusty crunch + low sting
          this.warmNoise.triggerAttackRelease('16n', now, 0.35);
          this.warmFm.triggerAttackRelease('Eb2', '8n', now, 0.32);
        } else {
          // Tails: glass crunch + hollow sting
          this.crispNoise.triggerAttackRelease('16n', now, 0.3);
          this.bellFm.triggerAttackRelease('Eb4', '8n', now, 0.28);
        }
        break;
      }

      case 'foeStep': {
        if (!isTails) {
          // Heads: tiny metallic clink of an old copper coin
          this.warmFm.triggerAttackRelease('A5', '64n', now, 0.14);
          this.metalCoin.triggerAttackRelease('64n', now, 0.1);
        } else {
          // Tails: crisp silver coin clink
          this.bellFm.triggerAttackRelease('E6', '64n', now, 0.18);
          this.metalCoin.triggerAttackRelease('64n', now, 0.14);
        }
        break;
      }

      case 'foeFall': {
        if (!isTails) {
          // Heads: bronze coin rattling down
          this.warmFm.triggerAttackRelease('G5', '64n', now, 0.14);
          this.warmFm.triggerAttackRelease('E5', '64n', now + 0.05, 0.12);
          this.warmFm.triggerAttackRelease('C5', '64n', now + 0.1, 0.1);
        } else {
          // Tails: silver coin rattling down
          this.bellFm.triggerAttackRelease('G6', '64n', now, 0.16);
          this.bellFm.triggerAttackRelease('E6', '64n', now + 0.05, 0.14);
          this.bellFm.triggerAttackRelease('C6', '64n', now + 0.1, 0.12);
        }
        break;
      }

      case 'flip': {
        // Dual-world shimmering rising chime: Heads & Tails combined
        this.polyChime.triggerAttackRelease('C4', '16n', now, 0.2);
        this.polyChime.triggerAttackRelease('E4', '16n', now + 0.035, 0.22);
        this.polyChime.triggerAttackRelease('G4', '16n', now + 0.07, 0.24);
        this.polyChime.triggerAttackRelease('C5', '16n', now + 0.105, 0.26);
        this.warmFm.triggerAttackRelease('E5', '8n', now + 0.14, 0.2);
        this.bellFm.triggerAttackRelease('G5', '8n', now + 0.14, 0.2);
        break;
      }

      case 'align': {
        // Soft two-note chime a fifth apart
        if (!isTails) {
          this.warmFm.triggerAttackRelease('C4', '16n', now, 0.24);
          this.warmFm.triggerAttackRelease('G4', '8n', now + 0.12, 0.24);
        } else {
          this.bellFm.triggerAttackRelease('G4', '16n', now, 0.22);
          this.bellFm.triggerAttackRelease('D5', '8n', now + 0.12, 0.22);
        }
        break;
      }

      case 'plateDown': {
        if (!isTails) {
          this.warmNoise.triggerAttackRelease('64n', now, 0.18);
          this.warmMembrane.triggerAttackRelease('G2', '64n', now, 0.14);
        } else {
          this.crispNoise.triggerAttackRelease('64n', now, 0.16);
          this.glassySynth.triggerAttackRelease('D4', '64n', now, 0.12);
        }
        break;
      }

      case 'plateUp': {
        if (!isTails) {
          this.warmNoise.triggerAttackRelease('64n', now, 0.14);
          this.warmMembrane.triggerAttackRelease('B2', '64n', now, 0.11);
        } else {
          this.crispNoise.triggerAttackRelease('64n', now, 0.13);
          this.glassySynth.triggerAttackRelease('F#4', '64n', now, 0.1);
        }
        break;
      }

      case 'gateOpen': {
        if (!isTails) {
          this.warmNoise.triggerAttackRelease('16n', now, 0.22);
          this.warmMembrane.triggerAttackRelease('E2', '16n', now, 0.14);
        } else {
          this.crispNoise.triggerAttackRelease('16n', now, 0.18);
          this.glassySynth.triggerAttackRelease('A3', '16n', now, 0.11);
        }
        break;
      }

      case 'gateClose': {
        if (!isTails) {
          this.warmNoise.triggerAttackRelease('16n', now, 0.24);
          this.warmMembrane.triggerAttackRelease('C2', '16n', now, 0.18);
        } else {
          this.crispNoise.triggerAttackRelease('16n', now, 0.2);
          this.glassySynth.triggerAttackRelease('F3', '16n', now, 0.14);
        }
        break;
      }

      case 'gateJam': {
        // Strained grind + spark
        this.warmNoise.triggerAttackRelease('16n', now, 0.26);
        this.metalCoin.triggerAttackRelease('64n', now + 0.05, 0.22);
        this.bellFm.triggerAttackRelease('F#5', '32n', now + 0.07, 0.18);
        break;
      }

      case 'seesaw': {
        // Creaky wooden tilt
        if (!isTails) {
          this.warmFm.triggerAttackRelease('A2', '16n', now, 0.2);
          this.warmNoise.triggerAttackRelease('32n', now, 0.12);
        } else {
          this.glassySynth.triggerAttackRelease('E4', '16n', now, 0.16);
          this.crispNoise.triggerAttackRelease('32n', now, 0.1);
        }
        break;
      }

      case 'undo': {
        // Short reversed shimmer
        this.crispNoise.triggerAttackRelease('16n', now, 0.14);
        this.polyChime.triggerAttackRelease('E5', '16n', now + 0.03, 0.16);
        this.polyChime.triggerAttackRelease('C5', '16n', now + 0.07, 0.18);
        break;
      }

      case 'restart': {
        // Quick coin spin zing
        this.metalCoin.triggerAttackRelease('16n', now, 0.22);
        this.bellFm.triggerAttackRelease('C5', '64n', now, 0.12);
        this.bellFm.triggerAttackRelease('G5', '64n', now + 0.03, 0.14);
        this.bellFm.triggerAttackRelease('C6', '32n', now + 0.06, 0.16);
        break;
      }

      case 'hint': {
        // Soft bell
        if (!isTails) {
          this.warmFm.triggerAttackRelease('E4', '4n', now, 0.22);
        } else {
          this.bellFm.triggerAttackRelease('E5', '4n', now, 0.2);
        }
        break;
      }

      case 'levelComplete': {
        // Metallic coin TING with long ring + rising arpeggio
        this.metalCoin.triggerAttackRelease('2n', now, 0.28);
        this.bellFm.triggerAttackRelease('C6', '1n', now, 0.24);
        this.polyChime.triggerAttackRelease('C4', '16n', now + 0.06, 0.18);
        this.polyChime.triggerAttackRelease('G4', '16n', now + 0.12, 0.2);
        this.polyChime.triggerAttackRelease('C5', '16n', now + 0.18, 0.22);
        this.polyChime.triggerAttackRelease('E5', '8n', now + 0.24, 0.24);
        break;
      }

      case 'chapterComplete': {
        // Soft celebratory fanfare arpeggio
        this.polyChime.triggerAttackRelease('C4', '16n', now, 0.18);
        this.polyChime.triggerAttackRelease('E4', '16n', now + 0.09, 0.18);
        this.polyChime.triggerAttackRelease('G4', '16n', now + 0.18, 0.2);
        this.polyChime.triggerAttackRelease('C5', '16n', now + 0.27, 0.22);
        this.polyChime.triggerAttackRelease('E5', '16n', now + 0.36, 0.22);
        this.polyChime.triggerAttackRelease(['G5', 'C6'], '2n', now + 0.45, 0.25);
        this.bellFm.triggerAttackRelease('C6', '1n', now + 0.45, 0.22);
        break;
      }

      case 'uiHover': {
        // Very quiet tick
        this.crispNoise.triggerAttackRelease('64n', now, 0.04);
        break;
      }

      case 'uiClick': {
        // Soft click
        this.warmMembrane.triggerAttackRelease('C3', '64n', now, 0.08);
        this.warmNoise.triggerAttackRelease('64n', now, 0.06);
        break;
      }
    }
  }
}
