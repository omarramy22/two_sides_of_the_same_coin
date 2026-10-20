import * as Tone from 'tone';
import type { Mixer } from '../mixer';

/**
 * Melody note definition within a 16-bar phrase.
 * Scale degree: 1 = C, 2 = D, 3 = E, 4 = F, 5 = G, 6 = A, 7 = B
 */
interface MelodyNote {
  bar: number; // 0..15
  beat: number; // 0..3
  sub: number; // 0 for on-beat, 0.5 for eighth-note off-beat
  degree: number; // 1..7 (diatonic in C major / A natural minor)
  octave: number; // typically 4 or 5
  duration: string; // Tone.js time notation, e.g. '4n', '8n', '2n'
  velocity?: number;
}

interface ChordInfo {
  name: string;
  tones: readonly number[]; // semitone pitch classes (0=C, 2=D, 4=E, etc.)
  rootNote: string;
  padNotes: readonly string[];
  nylonArp: readonly string[];
}

/**
 * Shared 16-bar harmonic progression (§6.1):
 * | C | Am | F | G | C | Em | F | G | Am | F | C | G | F | G | C | C |
 * C major and A natural minor share the exact same diatonic pitch set.
 */
const CHORD_PROGRESSION: readonly ChordInfo[] = [
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['C4', 'E4', 'G4'], nylonArp: ['C3', 'G3', 'E4', 'G3'] },
  { name: 'Am', tones: [9, 0, 4], rootNote: 'A1', padNotes: ['A3', 'C4', 'E4'], nylonArp: ['A2', 'E3', 'C4', 'E3'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'], nylonArp: ['F2', 'C3', 'A3', 'C3'] },
  { name: 'G', tones: [7, 11, 2], rootNote: 'G1', padNotes: ['G3', 'B3', 'D4'], nylonArp: ['G2', 'D3', 'B3', 'D3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['C4', 'E4', 'G4'], nylonArp: ['C3', 'G3', 'E4', 'G3'] },
  { name: 'Em', tones: [4, 7, 11], rootNote: 'E1', padNotes: ['E3', 'G3', 'B3'], nylonArp: ['E2', 'B2', 'G3', 'B2'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'], nylonArp: ['F2', 'C3', 'A3', 'C3'] },
  { name: 'G', tones: [7, 11, 2], rootNote: 'G1', padNotes: ['G3', 'B3', 'D4'], nylonArp: ['G2', 'D3', 'B3', 'D3'] },
  { name: 'Am', tones: [9, 0, 4], rootNote: 'A1', padNotes: ['A3', 'C4', 'E4'], nylonArp: ['A2', 'E3', 'C4', 'E3'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'], nylonArp: ['F2', 'C3', 'A3', 'C3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['C4', 'E4', 'G4'], nylonArp: ['C3', 'G3', 'E4', 'G3'] },
  { name: 'G', tones: [7, 11, 2], rootNote: 'G1', padNotes: ['G3', 'B3', 'D4'], nylonArp: ['G2', 'D3', 'B3', 'D3'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'], nylonArp: ['F2', 'C3', 'A3', 'C3'] },
  { name: 'G', tones: [7, 11, 2], rootNote: 'G1', padNotes: ['G3', 'B3', 'D4'], nylonArp: ['G2', 'D3', 'B3', 'D3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['C4', 'E4', 'G4'], nylonArp: ['C3', 'G3', 'E4', 'G3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['C4', 'E4', 'G4'], nylonArp: ['C3', 'G3', 'E4', 'G3'] },
];

const DEGREE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

function midiToNoteName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[noteIndex]}${oct}`;
}

/**
 * THREE 16-BAR MELODY VARIANTS (A, A', B)
 * Singable, warm scale degrees in C major, chord tones on strong beats with breathing pauses.
 */
const VARIANT_A: readonly MelodyNote[] = [
  // Bar 0: C
  { bar: 0, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' }, // E4
  { bar: 0, beat: 1, sub: 0, degree: 5, octave: 4, duration: '4n' }, // G4
  { bar: 0, beat: 2, sub: 0, degree: 1, octave: 5, duration: '4n.' }, // C5
  { bar: 0, beat: 3, sub: 0.5, degree: 7, octave: 4, duration: '8n' }, // B4 (passing)
  // Bar 1: Am
  { bar: 1, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' }, // A4
  { bar: 1, beat: 2, sub: 0, degree: 1, octave: 5, duration: '4n' }, // C5
  { bar: 1, beat: 3, sub: 0, degree: 3, octave: 5, duration: '4n' }, // E5
  // Bar 2: F
  { bar: 2, beat: 0, sub: 0, degree: 4, octave: 5, duration: '4n' }, // F5
  { bar: 2, beat: 1, sub: 0, degree: 3, octave: 5, duration: '4n' }, // E5
  { bar: 2, beat: 2, sub: 0, degree: 2, octave: 5, duration: '4n' }, // D5
  { bar: 2, beat: 3, sub: 0, degree: 1, octave: 5, duration: '4n' }, // C5
  // Bar 3: G (breath)
  { bar: 3, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n.' }, // B4
  // Bar 4: C
  { bar: 4, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' }, // E4
  { bar: 4, beat: 1, sub: 0, degree: 4, octave: 4, duration: '4n' }, // F4
  { bar: 4, beat: 2, sub: 0, degree: 5, octave: 4, duration: '4n' }, // G4
  { bar: 4, beat: 3, sub: 0, degree: 1, octave: 5, duration: '4n' }, // C5
  // Bar 5: Em
  { bar: 5, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n' }, // B4
  { bar: 5, beat: 2, sub: 0, degree: 5, octave: 4, duration: '4n' }, // G4
  { bar: 5, beat: 3, sub: 0, degree: 3, octave: 4, duration: '4n' }, // E4
  // Bar 6: F
  { bar: 6, beat: 0, sub: 0, degree: 6, octave: 4, duration: '4n' }, // A4
  { bar: 6, beat: 1, sub: 0, degree: 1, octave: 5, duration: '4n' }, // C5
  { bar: 6, beat: 2, sub: 0, degree: 4, octave: 5, duration: '2n' }, // F5
  // Bar 7: G
  { bar: 7, beat: 0, sub: 0, degree: 2, octave: 5, duration: '2n' }, // D5
  { bar: 7, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' }, // G4
  // Bar 8: Am
  { bar: 8, beat: 0, sub: 0, degree: 3, octave: 5, duration: '2n' }, // E5
  { bar: 8, beat: 2, sub: 0, degree: 1, octave: 5, duration: '4n' }, // C5
  { bar: 8, beat: 3, sub: 0, degree: 6, octave: 4, duration: '4n' }, // A4
  // Bar 9: F
  { bar: 9, beat: 0, sub: 0, degree: 1, octave: 5, duration: '4n' }, // C5
  { bar: 9, beat: 1, sub: 0, degree: 6, octave: 4, duration: '4n' }, // A4
  { bar: 9, beat: 2, sub: 0, degree: 4, octave: 4, duration: '2n' }, // F4
  // Bar 10: C
  { bar: 10, beat: 0, sub: 0, degree: 5, octave: 4, duration: '2n.' }, // G4
  { bar: 10, beat: 3, sub: 0, degree: 3, octave: 4, duration: '4n' }, // E4
  // Bar 11: G
  { bar: 11, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n' }, // D4
  { bar: 11, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' }, // G4
  // Bar 12: F
  { bar: 12, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' }, // A4
  { bar: 12, beat: 2, sub: 0, degree: 1, octave: 5, duration: '2n' }, // C5
  // Bar 13: G
  { bar: 13, beat: 0, sub: 0, degree: 7, octave: 4, duration: '4n' }, // B4
  { bar: 13, beat: 1, sub: 0, degree: 2, octave: 5, duration: '4n' }, // D5
  { bar: 13, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' }, // G4
  // Bar 14: C
  { bar: 14, beat: 0, sub: 0, degree: 1, octave: 5, duration: '1m' }, // C5
  // Bar 15: C (restful breath)
  { bar: 15, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n' }, // E4
];

const VARIANT_A_PRIME: readonly MelodyNote[] = [
  // Bar 0: C (ornamented start)
  { bar: 0, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' },
  { bar: 0, beat: 1, sub: 0, degree: 5, octave: 4, duration: '8n' },
  { bar: 0, beat: 1, sub: 0.5, degree: 6, octave: 4, duration: '8n' },
  { bar: 0, beat: 2, sub: 0, degree: 1, octave: 5, duration: '2n' },
  // Bar 1: Am
  { bar: 1, beat: 0, sub: 0, degree: 6, octave: 4, duration: '4n' },
  { bar: 1, beat: 1, sub: 0, degree: 1, octave: 5, duration: '4n' },
  { bar: 1, beat: 2, sub: 0, degree: 3, octave: 5, duration: '2n' },
  // Bar 2: F
  { bar: 2, beat: 0, sub: 0, degree: 4, octave: 5, duration: '4n.' },
  { bar: 2, beat: 1, sub: 0.5, degree: 3, octave: 5, duration: '8n' },
  { bar: 2, beat: 2, sub: 0, degree: 2, octave: 5, duration: '4n' },
  { bar: 2, beat: 3, sub: 0, degree: 1, octave: 5, duration: '4n' },
  // Bar 3: G
  { bar: 3, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n' },
  { bar: 3, beat: 2, sub: 0, degree: 2, octave: 5, duration: '2n' },
  // Bar 4: C
  { bar: 4, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' },
  { bar: 4, beat: 1, sub: 0, degree: 5, octave: 4, duration: '4n' },
  { bar: 4, beat: 2, sub: 0, degree: 1, octave: 5, duration: '4n' },
  { bar: 4, beat: 3, sub: 0, degree: 5, octave: 5, duration: '4n' }, // soaring high G5
  // Bar 5: Em
  { bar: 5, beat: 0, sub: 0, degree: 3, octave: 5, duration: '2n' },
  { bar: 5, beat: 2, sub: 0, degree: 7, octave: 4, duration: '2n' },
  // Bar 6: F
  { bar: 6, beat: 0, sub: 0, degree: 1, octave: 5, duration: '4n' },
  { bar: 6, beat: 1, sub: 0, degree: 6, octave: 4, duration: '4n' },
  { bar: 6, beat: 2, sub: 0, degree: 4, octave: 5, duration: '2n' },
  // Bar 7: G
  { bar: 7, beat: 0, sub: 0, degree: 2, octave: 5, duration: '4n.' },
  { bar: 7, beat: 1, sub: 0.5, degree: 1, octave: 5, duration: '8n' },
  { bar: 7, beat: 2, sub: 0, degree: 7, octave: 4, duration: '2n' },
  // Bar 8: Am
  { bar: 8, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' },
  { bar: 8, beat: 2, sub: 0, degree: 3, octave: 5, duration: '2n' },
  // Bar 9: F
  { bar: 9, beat: 0, sub: 0, degree: 4, octave: 5, duration: '4n' },
  { bar: 9, beat: 1, sub: 0, degree: 1, octave: 5, duration: '4n' },
  { bar: 9, beat: 2, sub: 0, degree: 6, octave: 4, duration: '2n' },
  // Bar 10: C
  { bar: 10, beat: 0, sub: 0, degree: 5, octave: 4, duration: '2n' },
  { bar: 10, beat: 2, sub: 0, degree: 3, octave: 4, duration: '2n' },
  // Bar 11: G
  { bar: 11, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n' },
  { bar: 11, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' },
  // Bar 12: F
  { bar: 12, beat: 0, sub: 0, degree: 6, octave: 4, duration: '4n' },
  { bar: 12, beat: 1, sub: 0, degree: 1, octave: 5, duration: '4n' },
  { bar: 12, beat: 2, sub: 0, degree: 4, octave: 5, duration: '2n' },
  // Bar 13: G
  { bar: 13, beat: 0, sub: 0, degree: 2, octave: 5, duration: '4n' },
  { bar: 13, beat: 1, sub: 0, degree: 7, octave: 4, duration: '4n' },
  { bar: 13, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' },
  // Bar 14: C
  { bar: 14, beat: 0, sub: 0, degree: 1, octave: 5, duration: '2n' },
  { bar: 14, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' },
  // Bar 15: C
  { bar: 15, beat: 0, sub: 0, degree: 1, octave: 5, duration: '2n.' },
];

const VARIANT_B: readonly MelodyNote[] = [
  // Bar 0: C (starts higher, reflective)
  { bar: 0, beat: 0, sub: 0, degree: 5, octave: 4, duration: '2n' },
  { bar: 0, beat: 2, sub: 0, degree: 3, octave: 4, duration: '4n' },
  { bar: 0, beat: 3, sub: 0, degree: 1, octave: 4, duration: '4n' },
  // Bar 1: Am
  { bar: 1, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n.' },
  { bar: 1, beat: 3, sub: 0, degree: 1, octave: 5, duration: '4n' },
  // Bar 2: F
  { bar: 2, beat: 0, sub: 0, degree: 4, octave: 4, duration: '2n' },
  { bar: 2, beat: 2, sub: 0, degree: 6, octave: 4, duration: '2n' },
  // Bar 3: G
  { bar: 3, beat: 0, sub: 0, degree: 5, octave: 4, duration: '1m' },
  // Bar 4: C
  { bar: 4, beat: 0, sub: 0, degree: 1, octave: 5, duration: '2n' },
  { bar: 4, beat: 2, sub: 0, degree: 7, octave: 4, duration: '4n' },
  { bar: 4, beat: 3, sub: 0, degree: 6, octave: 4, duration: '4n' },
  // Bar 5: Em
  { bar: 5, beat: 0, sub: 0, degree: 5, octave: 4, duration: '2n' },
  { bar: 5, beat: 2, sub: 0, degree: 3, octave: 4, duration: '2n' },
  // Bar 6: F
  { bar: 6, beat: 0, sub: 0, degree: 4, octave: 4, duration: '4n' },
  { bar: 6, beat: 1, sub: 0, degree: 6, octave: 4, duration: '4n' },
  { bar: 6, beat: 2, sub: 0, degree: 1, octave: 5, duration: '2n' },
  // Bar 7: G
  { bar: 7, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n' },
  { bar: 7, beat: 2, sub: 0, degree: 2, octave: 5, duration: '2n' },
  // Bar 8: Am
  { bar: 8, beat: 0, sub: 0, degree: 3, octave: 5, duration: '2n' },
  { bar: 8, beat: 2, sub: 0, degree: 2, octave: 5, duration: '4n' },
  { bar: 8, beat: 3, sub: 0, degree: 1, octave: 5, duration: '4n' },
  // Bar 9: F
  { bar: 9, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' },
  { bar: 9, beat: 2, sub: 0, degree: 4, octave: 4, duration: '2n' },
  // Bar 10: C
  { bar: 10, beat: 0, sub: 0, degree: 5, octave: 4, duration: '2n.' },
  { bar: 10, beat: 3, sub: 0, degree: 6, octave: 4, duration: '4n' },
  // Bar 11: G
  { bar: 11, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n' },
  { bar: 11, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' },
  // Bar 12: F
  { bar: 12, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' },
  { bar: 12, beat: 2, sub: 0, degree: 4, octave: 4, duration: '2n' },
  // Bar 13: G
  { bar: 13, beat: 0, sub: 0, degree: 5, octave: 4, duration: '2n' },
  { bar: 13, beat: 2, sub: 0, degree: 2, octave: 4, duration: '2n' },
  // Bar 14: C
  { bar: 14, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n' },
  { bar: 14, beat: 2, sub: 0, degree: 2, octave: 4, duration: '2n' },
  // Bar 15: C
  { bar: 15, beat: 0, sub: 0, degree: 1, octave: 4, duration: '1m' },
];

/**
 * Converts scale degree and octave into absolute scale degree index.
 * C4 is reference index 0.
 */
function getAbsoluteDegree(degree: number, octave: number): number {
  return (octave - 4) * 7 + (degree - 1);
}

/**
 * Transforms Heads scale degree into Tails inverted note:
 *
 * HOW THE GAME'S THEME (TWO SIDES OF ONE COIN) LIVES IN THE MUSIC:
 * Sol (Heads) and Lune (Tails) are bound together by an exact conservation law.
 * In the audio engine, the Tails melody is the mathematical diatonic inversion of
 * Sol's melody flipped across the opening pivot note and raised an octave into A natural minor.
 *
 * To ensure consonant harmonic resonance across the seam between both worlds, every inverted note
 * landing on a beat is snapped to the nearest chord tone of that bar's chord, while off-beat
 * passing tones are preserved if they are within a diatonic step of the harmony.
 */
function invertAndSnap(
  note: MelodyNote,
  pivotAbsDegree: number,
  chord: ChordInfo
): { noteName: string; duration: string; velocity: number } {
  const headsAbs = getAbsoluteDegree(note.degree, note.octave);
  const intervalFromPivot = headsAbs - pivotAbsDegree;
  // Diatonic inversion: flip interval around the pivot note
  const invertedAbs = pivotAbsDegree - intervalFromPivot;
  // Voiced one octave higher in A natural minor / C major (+7 scale degrees)
  const tailsAbs = invertedAbs + 7;

  const degIndex = ((tailsAbs % 7) + 7) % 7;
  const oct = 4 + Math.floor(tailsAbs / 7);
  const candidateMidi = (oct + 1) * 12 + DEGREE_SEMITONES[degIndex];

  let finalMidi = candidateMidi;
  const pitchClass = ((candidateMidi % 12) + 12) % 12;
  const isChordTone = chord.tones.includes(pitchClass);

  const isOnBeat = note.sub === 0;

  if (isOnBeat) {
    if (!isChordTone) {
      // Snap to nearest chord tone in pitch
      finalMidi = snapToNearestChordTone(candidateMidi, chord.tones);
    }
  } else {
    // Off-beat: retain as passing tone only if it is a diatonic step (<= 2 semitones) away
    const isStepAway = chord.tones.some(ct => {
      const diff = Math.abs(pitchClass - ct);
      const minDistance = Math.min(diff, 12 - diff);
      return minDistance <= 2;
    });
    if (!isStepAway && !isChordTone) {
      finalMidi = snapToNearestChordTone(candidateMidi, chord.tones);
    }
  }

  return {
    noteName: midiToNoteName(finalMidi),
    duration: note.duration,
    velocity: note.velocity ?? 0.35,
  };
}

function snapToNearestChordTone(targetMidi: number, chordTones: readonly number[]): number {
  let closestMidi = targetMidi;
  let minDiff = Infinity;

  // Search across adjacent octaves for the closest chord tone
  for (let oct = -1; oct <= 1; oct++) {
    for (const ct of chordTones) {
      const candidate = (Math.floor(targetMidi / 12) + oct) * 12 + ct;
      const diff = Math.abs(candidate - targetMidi);
      if (diff < minDiff) {
        minDiff = diff;
        closestMidi = candidate;
      }
    }
  }
  return closestMidi;
}

export class Chapter1Theme {
  private readonly mixer: Mixer;
  private isPlaying = false;
  private isResolving = false;

  // HEADS synths
  private headsPluckSynth: Tone.PolySynth<Tone.FMSynth>;
  private headsNylonSynth: Tone.Synth;
  private headsBassSynth: Tone.Synth;

  // TAILS synths
  private tailsCelestaSynth: Tone.PolySynth<Tone.FMSynth>;
  private tailsPadSynth: Tone.PolySynth<Tone.Synth>;

  // UNISON choir pad synth
  private unisonPadSynth: Tone.PolySynth<Tone.Synth>;

  // Transport event parts
  private parts: Tone.Part[] = [];

  constructor(mixer: Mixer) {
    this.mixer = mixer;

    // HEADS LAYER: Warm kalimba/marimba pluck + soft nylon counter-voice + warm sine bass
    this.headsPluckSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.003, decay: 0.45, sustain: 0.02, release: 0.35 },
      modulationEnvelope: { attack: 0.003, decay: 0.25, sustain: 0, release: 0.25 },
    }).connect(this.mixer.headsChannel);
    this.headsPluckSynth.volume.value = -4;

    this.headsNylonSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.6, sustain: 0.1, release: 0.5 },
      volume: -9,
    }).connect(this.mixer.headsChannel);

    this.headsBassSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.8, sustain: 0.5, release: 0.8 },
      volume: -6,
    }).connect(this.mixer.headsChannel);

    // TAILS LAYER: Glassy celesta/bell FMSynth + slow sustaining chord pad
    this.tailsCelestaSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.02,
      modulationIndex: 4.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.85, sustain: 0.04, release: 1.1 },
      modulationEnvelope: { attack: 0.005, decay: 0.35, sustain: 0, release: 0.35 },
    }).connect(this.mixer.tailsChannel);
    this.tailsCelestaSynth.volume.value = -5;

    this.tailsPadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1.2, decay: 1.0, sustain: 0.7, release: 2.0 },
    }).connect(this.mixer.tailsChannel);
    this.tailsPadSynth.volume.value = -12;

    // UNISON LAYER: Choir-like warm pad with ensemble character
    this.unisonPadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.4, decay: 0.8, sustain: 0.6, release: 1.2 },
    }).connect(this.mixer.unisonChannel);
    this.unisonPadSynth.volume.value = -6;

    this.buildComposition();
  }

  /**
   * Constructs the 64-bar cycling composition (A, A', B, A').
   * Deterministic, synced via Tone.Transport.
   */
  private buildComposition(): void {
    const phrases = [
      { offsetBar: 0, melody: VARIANT_A },
      { offsetBar: 16, melody: VARIANT_A_PRIME },
      { offsetBar: 32, melody: VARIANT_B },
      { offsetBar: 48, melody: VARIANT_A_PRIME },
    ];

    const pivotAbsDegree = getAbsoluteDegree(VARIANT_A[0].degree, VARIANT_A[0].octave);

    interface ScheduledPluck {
      time: string;
      headsNote: string;
      tailsNote: string;
      duration: string;
      headsVel: number;
      tailsVel: number;
    }
    const melodicEvents: ScheduledPluck[] = [];

    for (const phrase of phrases) {
      for (const note of phrase.melody) {
        const absoluteBar = phrase.offsetBar + note.bar;
        const subFraction = note.sub === 0 ? '0' : '2'; // sixteenth subdivision
        const timeStr = `${absoluteBar}:${note.beat}:${subFraction}`;

        const headsDeg = DEGREE_NAMES[note.degree - 1];
        const headsNote = `${headsDeg}${note.octave}`;

        const chord = CHORD_PROGRESSION[note.bar];
        const inverted = invertAndSnap(note, pivotAbsDegree, chord);

        melodicEvents.push({
          time: timeStr,
          headsNote,
          tailsNote: inverted.noteName,
          duration: note.duration,
          headsVel: note.velocity ?? 0.38,
          tailsVel: inverted.velocity,
        });
      }
    }

    // Melodic part
    const melodyPart = new Tone.Part<ScheduledPluck>((time, event) => {
      if (this.isResolving) return;

      // Heads kalimba
      this.headsPluckSynth.triggerAttackRelease(
        event.headsNote,
        event.duration,
        time,
        event.headsVel
      );

      // Tails celesta (inverted melody, snapped to harmony)
      this.tailsCelestaSynth.triggerAttackRelease(
        event.tailsNote,
        event.duration,
        time,
        event.tailsVel
      );

      // Unison choir pad: plays both melodies simultaneously an octave apart
      this.unisonPadSynth.triggerAttackRelease(
        [event.headsNote, event.tailsNote],
        event.duration,
        time,
        0.28
      );
    }, melodicEvents);

    melodyPart.loop = true;
    melodyPart.loopStart = '0:0:0';
    melodyPart.loopEnd = '64:0:0';
    this.parts.push(melodyPart);

    // Harmonic accompaniment: nylon arpeggio, bass roots, and tails pad chords
    interface HarmonyEvent {
      time: string;
      chord: ChordInfo;
    }
    const harmonyEvents: HarmonyEvent[] = [];

    for (let bar = 0; bar < 64; bar++) {
      const chord = CHORD_PROGRESSION[bar % 16];
      harmonyEvents.push({ time: `${bar}:0:0`, chord });
    }

    const harmonyPart = new Tone.Part<HarmonyEvent>((time, event) => {
      if (this.isResolving) return;

      const chord = event.chord;

      // Heads warm sine bass
      this.headsBassSynth.triggerAttackRelease(chord.rootNote, '1m', time, 0.45);

      // Heads nylon gentle arpeggiation (4 quarter notes per measure)
      const baseTime = Tone.Time(time).toSeconds();
      const quarterSec = Tone.Time('4n').toSeconds();
      chord.nylonArp.forEach((note, idx) => {
        this.headsNylonSynth.triggerAttackRelease(note, '4n', baseTime + idx * quarterSec, 0.22);
      });

      // Tails slow sustaining atmospheric chord pad
      this.tailsPadSynth.triggerAttackRelease([...chord.padNotes], '1m', time, 0.28);
    }, harmonyEvents);

    harmonyPart.loop = true;
    harmonyPart.loopStart = '0:0:0';
    harmonyPart.loopEnd = '64:0:0';
    this.parts.push(harmonyPart);
  }

  async start(): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.isResolving = false;

    const stems = await this.mixer.loadStemsIfAvailable();

    Tone.getTransport().bpm.value = 84;
    Tone.getTransport().timeSignature = 4;
    Tone.getTransport().loop = true;
    Tone.getTransport().loopStart = '0:0:0';
    Tone.getTransport().loopEnd = '64:0:0';

    if (stems?.heads && stems?.tails) {
      // Pre-recorded stems take precedence over code synthesis
      stems.heads.start(0);
      stems.tails.start(0);
      if (stems.unison) stems.unison.start(0);
    } else {
      // Start code-composed parts
      for (const part of this.parts) {
        part.start(0);
      }
    }

    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  stop(fadeSec = 1.0): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isResolving = false;

    this.mixer.musicBus.volume.rampTo(-60, fadeSec);

    setTimeout(() => {
      try {
        for (const part of this.parts) {
          part.stop();
        }
        const stems = this.mixer.getStems();
        if (stems) {
          stems.heads?.stop();
          stems.tails?.stop();
          stems.unison?.stop();
        }
        Tone.getTransport().stop();
        this.mixer.musicBus.volume.value = this.mixer.musicLevelDb;
      } catch {
        // Safe no-op on teardown
      }
    }, fadeSec * 1000 + 50);
  }

  /**
   * LEVEL COMPLETE RESOLUTION (§6.1):
   * At the next beat, both melodic layers resolve onto one shared C major chord:
   * Heads plays a warm lower voicing, Tails plays a bell voicing an octave up.
   * Rings for ~2 seconds, then resumes the loop from phrase start (0:0:0).
   */
  resolve(): void {
    if (!this.isPlaying || this.isResolving) return;
    this.isResolving = true;

    const transport = Tone.getTransport();
    const nowTime = Tone.now();
    const nextBeatTime = nowTime + 0.08;

    // Heads warm C major voicing: [C3, G3, E4, G4]
    const headsChord = ['C3', 'G3', 'E4', 'G4'];
    // Tails bell C major voicing one octave higher: [C5, E5, G5, C6]
    const tailsChord = ['C5', 'E5', 'G5', 'C6'];

    this.headsPluckSynth.triggerAttackRelease(headsChord, '2n', nextBeatTime, 0.42);
    this.tailsCelestaSynth.triggerAttackRelease(tailsChord, '2n', nextBeatTime, 0.38);

    // After ~2 seconds of resonant ring, resume loop from the start of phrase
    setTimeout(() => {
      try {
        if (!this.isPlaying) return;
        transport.position = '0:0:0';
        this.isResolving = false;
      } catch {
        this.isResolving = false;
      }
    }, 2200);
  }
}
