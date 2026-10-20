import * as Tone from 'tone';
import type { Mixer } from '../mixer';
import { DEGREE_NAMES, getAbsoluteDegree, invertAndSnap, type ChordInfo, type MelodyNote } from './ch2';

/**
 * Chapter 3, The Stone: a slow, echoing cave of carved stone where light and shadow trade places.
 * Same construction as Chapter 2 (Heads melody, its diatonic inversion for Tails snapped to the
 * shared chord, a unison layer that blooms when the halves line up), written in F and sounded
 * a minor third lower (D major / B minor) so the chapter has its own colour.
 * Heads: a plucked stone harp. Tails: bowed glass. Drips echo in the dark.
 */
const TRANSPOSE = -3;
const BARS = 16;

const C = (name: string, tones: number[], rootNote: string, padNotes: string[]): ChordInfo => ({ name, tones, rootNote, padNotes });
const F = C('F', [5, 9, 0], 'F1', ['F3', 'A3', 'C4']);
const Cmaj = C('C', [0, 4, 7], 'C2', ['E3', 'G3', 'C4']);
const Dm = C('Dm', [2, 5, 9], 'D1', ['D3', 'F3', 'A3']);
const Bb = C('Bb', [10, 2, 5], 'Bb1', ['D3', 'F3', 'Bb3']);
const Gm = C('Gm', [7, 10, 2], 'G1', ['D3', 'G3', 'Bb3']);
const Am = C('Am', [9, 0, 4], 'A1', ['E3', 'A3', 'C4']);
const PROGRESSION: readonly ChordInfo[] = [F, F, Cmaj, Dm, Bb, F, Gm, Cmaj, Dm, Am, Bb, F, Gm, Dm, Cmaj, F];

// Sparse on purpose: long notes that ring in the stone, rests for the echoes.
// [bar, beat, sub, degree (1 = F ... 7 = E), octave, duration]
type N = [number, number, number, number, number, string];
const mk = (ns: N[]): MelodyNote[] => ns.map(([bar, beat, sub, degree, octave, duration]) => ({ bar, beat, sub, degree, octave, duration }));
const PHRASE_A = mk([
  [0, 0, 0, 5, 5, '2n'], [0, 2, 0, 3, 4, '4n'], [0, 3, 0, 5, 5, '4n'],
  [1, 0, 0, 1, 4, '1m'],
  [2, 0, 0, 2, 4, '4n.'], [2, 1, 0.5, 3, 4, '8n'], [2, 2, 0, 5, 5, '2n'],
  [3, 0, 0, 6, 5, '2n.'], [3, 3, 0, 5, 5, '4n'],
  [4, 0, 0, 4, 4, '2n'], [4, 2, 0, 6, 5, '4n'], [4, 3, 0, 4, 4, '4n'],
  [5, 0, 0, 3, 4, '1m'],
  [6, 0, 0, 2, 4, '4n'], [6, 1, 0, 4, 4, '4n'], [6, 2, 0, 6, 5, '2n'],
  [7, 0, 0, 5, 5, '1m'],
  [8, 0, 0, 6, 5, '2n'], [8, 2, 0, 3, 4, '2n'],
  [9, 0, 0, 3, 4, '4n.'], [9, 1, 0.5, 2, 4, '8n'], [9, 2, 0, 1, 4, '2n'],
  [10, 0, 0, 4, 4, '2n'], [10, 2, 0, 6, 5, '4n'], [10, 3, 0, 5, 5, '4n'],
  [11, 0, 0, 3, 4, '1m'],
  [12, 0, 0, 2, 4, '2n'], [12, 2, 0, 4, 4, '2n'],
  [13, 0, 0, 3, 4, '2n'], [13, 2, 0, 1, 4, '2n'],
  [14, 0, 0, 7, 5, '2n'], [14, 2, 0, 2, 4, '2n'],
  [15, 0, 0, 1, 4, '1m'],
]);
const PHRASE_B = mk([
  [0, 0, 0, 3, 4, '2n'], [0, 2, 0, 1, 5, '2n'],
  [1, 0, 0, 7, 5, '4n'], [1, 1, 0, 5, 5, '4n'], [1, 2, 0, 3, 4, '2n'],
  [2, 0, 0, 7, 5, '1m'],
  [3, 0, 0, 6, 5, '4n'], [3, 1, 0, 5, 5, '4n'], [3, 2, 0, 3, 4, '2n'],
  [4, 0, 0, 2, 4, '2n.'], [4, 3, 0, 4, 4, '4n'],
  [5, 0, 0, 5, 5, '2n'], [5, 2, 0, 3, 4, '2n'],
  [6, 0, 0, 2, 4, '4n'], [6, 1, 0, 4, 4, '4n'], [6, 2, 0, 2, 4, '2n'],
  [7, 0, 0, 7, 5, '1m'],
  [8, 0, 0, 3, 4, '2n'], [8, 2, 0, 6, 5, '2n'],
  [9, 0, 0, 5, 5, '2n'], [9, 2, 0, 7, 5, '2n'],
  [10, 0, 0, 6, 5, '4n.'], [10, 1, 0.5, 5, 5, '8n'], [10, 2, 0, 4, 4, '2n'],
  [11, 0, 0, 5, 5, '1m'],
  [12, 0, 0, 4, 4, '2n'], [12, 2, 0, 2, 4, '2n'],
  [13, 0, 0, 1, 4, '2n'], [13, 2, 0, 3, 4, '2n'],
  [14, 0, 0, 2, 4, '2n'], [14, 2, 0, 7, 5, '2n'],
  [15, 0, 0, 1, 4, '1m'],
]);
/** A drip somewhere in the dark: [bar within the phrase, beat, note]. */
const DRIPS: [number, number, string][] = [[1, 2.5, 'C7'], [3, 1, 'G6'], [5, 3, 'F6'], [7, 0.5, 'C7'], [9, 2, 'A6'], [11, 3.5, 'G6'], [13, 1.5, 'C7'], [15, 2, 'F6']];

const tr = (n: string) => Tone.Frequency(n).transpose(TRANSPOSE).toNote();

export class Chapter3Theme {
  private isPlaying = false;
  private isResolving = false;
  private harp: Tone.PolySynth<Tone.FMSynth>;
  private bass: Tone.Synth;
  private glass: Tone.PolySynth<Tone.AMSynth>;
  private pad: Tone.PolySynth<Tone.Synth>;
  private unison: Tone.PolySynth<Tone.Synth>;
  private drip: Tone.Synth;
  private parts: Tone.Part[] = [];

  constructor(private readonly mixer: Mixer) {
    this.harp = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 2.2,
      envelope: { attack: 0.003, decay: 1.1, sustain: 0.02, release: 0.9 },
      modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
    }).connect(mixer.headsChannel);
    this.harp.volume.value = -5;
    this.bass = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 1.6, sustain: 0.3, release: 1.4 }, volume: -7 }).connect(mixer.headsChannel);
    this.glass = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2.01,
      envelope: { attack: 0.35, decay: 0.8, sustain: 0.5, release: 1.8 },
      modulationEnvelope: { attack: 0.5, decay: 0.4, sustain: 0.6, release: 1.5 },
    }).connect(mixer.tailsChannel);
    this.glass.volume.value = -9;
    this.pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 2, decay: 1, sustain: 0.7, release: 2.5 } }).connect(mixer.tailsChannel);
    this.pad.volume.value = -13;
    this.unison = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.5, decay: 0.8, sustain: 0.6, release: 1.4 } }).connect(mixer.unisonChannel);
    this.unison.volume.value = -7;
    this.drip = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.3 }, volume: -20 }).connect(mixer.tailsChannel);
    this.build();
  }

  /** 64 bars: A B A B. Deterministic, on the shared Transport. */
  private build() {
    const pivot = getAbsoluteDegree(PHRASE_A[0].degree, PHRASE_A[0].octave);
    const events: { time: string; heads: string; tails: string; dur: string }[] = [];
    [PHRASE_A, PHRASE_B, PHRASE_A, PHRASE_B].forEach((phrase, p) => {
      for (const note of phrase) {
        const inv = invertAndSnap(note, pivot, PROGRESSION[note.bar]);
        events.push({
          time: `${p * BARS + note.bar}:${note.beat}:${note.sub ? 2 : 0}`,
          heads: tr(`${DEGREE_NAMES[note.degree - 1]}${note.octave}`),
          tails: tr(inv.noteName),
          dur: note.duration,
        });
      }
    });
    const melody = new Tone.Part<(typeof events)[number]>((time, e) => {
      if (this.isResolving) return;
      this.harp.triggerAttackRelease(e.heads, e.dur, time, 0.36);
      this.glass.triggerAttackRelease(e.tails, e.dur, time, 0.3);
      this.unison.triggerAttackRelease([e.heads, e.tails], e.dur, time, 0.26);
    }, events);

    const bars = [...Array(64)].map((_, bar) => ({ time: `${bar}:0:0`, chord: PROGRESSION[bar % BARS], bar }));
    const harmony = new Tone.Part<(typeof bars)[number]>((time, e) => {
      if (this.isResolving) return;
      this.bass.triggerAttackRelease(tr(e.chord.rootNote), '1m', time, 0.42);
      if (e.bar % 2 === 0) this.pad.triggerAttackRelease(e.chord.padNotes.map(tr), '2m', time, 0.24);
      const d = DRIPS.find(([b]) => b === e.bar % BARS);
      if (d) this.drip.triggerAttackRelease(tr(d[2]), '32n', Tone.Time(time).toSeconds() + Tone.Time('4n').toSeconds() * d[1], 0.3);
    }, bars);

    for (const part of [melody, harmony]) {
      part.loop = true;
      part.loopStart = '0:0:0';
      part.loopEnd = '64:0:0';
      this.parts.push(part);
    }
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.isResolving = false;
    const t = Tone.getTransport();
    t.bpm.value = 64;
    t.timeSignature = 4;
    t.loop = true;
    t.loopStart = '0:0:0';
    t.loopEnd = '64:0:0';
    for (const part of this.parts) part.start(0);
    if (t.state !== 'started') t.start();
  }

  stop(fadeSec = 1.0): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isResolving = false;
    this.mixer.musicBus.volume.rampTo(-60, fadeSec);
    setTimeout(() => {
      try {
        for (const part of this.parts) part.stop();
        Tone.getTransport().stop();
        this.mixer.musicBus.volume.value = this.mixer.musicLevelDb;
      } catch {
        // Safe no-op on teardown
      }
    }, fadeSec * 1000 + 50);
  }

  setAligned(aligned: boolean): void {
    this.mixer.setAligned(aligned);
  }

  /** Level complete: both voices land on one shared tonic chord, ring, then the loop restarts. */
  resolve(): void {
    if (!this.isPlaying || this.isResolving) return;
    this.isResolving = true;
    const at = Tone.now() + 0.08;
    this.harp.triggerAttackRelease(['F3', 'C4', 'A4', 'C5'].map(tr), '2n', at, 0.42);
    this.glass.triggerAttackRelease(['F4', 'A4', 'C5', 'F5'].map(tr), '2n', at, 0.34);
    setTimeout(() => {
      try {
        if (!this.isPlaying) return;
        Tone.getTransport().position = '0:0:0';
        this.isResolving = false;
      } catch {
        this.isResolving = false;
      }
    }, 2200);
  }
}
