import * as Tone from 'tone';
import type { Mixer } from '../mixer';

/**
 * Melody note definition within a 16-bar phrase.
 * Scale degree: 1 = F, 2 = G, 3 = A, 4 = Bb, 5 = C, 6 = D, 7 = E
 */
export interface MelodyNote {
  bar: number; // 0..15
  beat: number; // 0..3
  sub: number; // 0 for on-beat, 0.5 for eighth-note off-beat
  degree: number; // 1..7 (diatonic in F major / D natural minor)
  octave: number; // typically 4 or 5
  duration: string; // Tone.js time notation, e.g. '4n', '8n', '2n'
  velocity?: number;
}

export interface ChordInfo {
  name: string;
  tones: readonly number[]; // semitone pitch classes (0=C, 2=D, 4=E, 5=F, 7=G, 9=A, 10=Bb)
  rootNote: string;
  padNotes: readonly string[];
}

/**
 * Shared 16-bar harmonic progression (§6.1):
 * | F | Dm | Bb | C | F | Am | Bb | C | Dm | Bb | F | C | Bb | C | F | F |
 * F major (Heads) and D natural minor (Tails) share the exact same diatonic pitch set.
 */
const CHORD_PROGRESSION: readonly ChordInfo[] = [
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'] },
  { name: 'Dm', tones: [2, 5, 9], rootNote: 'D1', padNotes: ['D3', 'F3', 'A3'] },
  { name: 'Bb', tones: [10, 2, 5], rootNote: 'Bb1', padNotes: ['D3', 'F3', 'Bb3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['E3', 'G3', 'C4'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'] },
  { name: 'Am', tones: [9, 0, 4], rootNote: 'A1', padNotes: ['E3', 'A3', 'C4'] },
  { name: 'Bb', tones: [10, 2, 5], rootNote: 'Bb1', padNotes: ['D3', 'F3', 'Bb3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['E3', 'G3', 'C4'] },
  { name: 'Dm', tones: [2, 5, 9], rootNote: 'D1', padNotes: ['D3', 'F3', 'A3'] },
  { name: 'Bb', tones: [10, 2, 5], rootNote: 'Bb1', padNotes: ['D3', 'F3', 'Bb3'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['E3', 'G3', 'C4'] },
  { name: 'Bb', tones: [10, 2, 5], rootNote: 'Bb1', padNotes: ['D3', 'F3', 'Bb3'] },
  { name: 'C', tones: [0, 4, 7], rootNote: 'C2', padNotes: ['E3', 'G3', 'C4'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'] },
  { name: 'F', tones: [5, 9, 0], rootNote: 'F1', padNotes: ['F3', 'A3', 'C4'] },
];

export const DEGREE_NAMES = ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'] as const;

function midiToNoteName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  return `${names[noteIndex]}${oct}`;
}

/**
 * THREE 16-BAR MELODY VARIANTS (A, A', B)
 * Earthy, woody scale degrees in F major, chord tones on strong beats with breathing pauses.
 */
const VARIANT_A: readonly MelodyNote[] = [
  // Bar 0: F
  { bar: 0, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  { bar: 0, beat: 1, sub: 0, degree: 5, octave: 5, duration: '4n' }, // C5
  { bar: 0, beat: 2, sub: 0, degree: 1, octave: 4, duration: '4n.' }, // F4
  { bar: 0, beat: 3, sub: 0.5, degree: 2, octave: 4, duration: '8n' }, // G4 (passing)
  // Bar 1: Dm
  { bar: 1, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' }, // D4
  { bar: 1, beat: 2, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  { bar: 1, beat: 3, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  // Bar 2: Bb
  { bar: 2, beat: 0, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 2, beat: 1, sub: 0, degree: 6, octave: 5, duration: '4n' }, // D5
  { bar: 2, beat: 2, sub: 0, degree: 5, octave: 5, duration: '4n' }, // C5
  { bar: 2, beat: 3, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  // Bar 3: C (breath)
  { bar: 3, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n.' }, // G4
  // Bar 4: F
  { bar: 4, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  { bar: 4, beat: 1, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 4, beat: 2, sub: 0, degree: 5, octave: 5, duration: '4n' }, // C5
  { bar: 4, beat: 3, sub: 0, degree: 1, octave: 5, duration: '4n' }, // F5
  // Bar 5: Am
  { bar: 5, beat: 0, sub: 0, degree: 7, octave: 5, duration: '2n' }, // E5
  { bar: 5, beat: 2, sub: 0, degree: 5, octave: 5, duration: '4n' }, // C5
  { bar: 5, beat: 3, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  // Bar 6: Bb
  { bar: 6, beat: 0, sub: 0, degree: 6, octave: 5, duration: '4n' }, // D5
  { bar: 6, beat: 1, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 6, beat: 2, sub: 0, degree: 1, octave: 4, duration: '2n' }, // F4
  // Bar 7: C
  { bar: 7, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  { bar: 7, beat: 2, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  // Bar 8: Dm (relative minor focus)
  { bar: 8, beat: 0, sub: 0, degree: 6, octave: 5, duration: '2n' }, // D5
  { bar: 8, beat: 2, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  { bar: 8, beat: 3, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  // Bar 9: Bb
  { bar: 9, beat: 0, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 9, beat: 1, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  { bar: 9, beat: 2, sub: 0, degree: 4, octave: 4, duration: '2n' }, // Bb4
  // Bar 10: F
  { bar: 10, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n.' }, // A4
  { bar: 10, beat: 3, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  // Bar 11: C
  { bar: 11, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  { bar: 11, beat: 2, sub: 0, degree: 7, octave: 4, duration: '2n' }, // E4
  // Bar 12: Bb
  { bar: 12, beat: 0, sub: 0, degree: 4, octave: 4, duration: '2n' }, // Bb4
  { bar: 12, beat: 2, sub: 0, degree: 6, octave: 4, duration: '2n' }, // D4
  // Bar 13: C
  { bar: 13, beat: 0, sub: 0, degree: 7, octave: 4, duration: '4n' }, // E4
  { bar: 13, beat: 1, sub: 0, degree: 2, octave: 4, duration: '4n' }, // G4
  { bar: 13, beat: 2, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  // Bar 14: F
  { bar: 14, beat: 0, sub: 0, degree: 1, octave: 4, duration: '1m' }, // F4
  // Bar 15: F (restful breath)
  { bar: 15, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
];

const VARIANT_A_PRIME: readonly MelodyNote[] = [
  // Bar 0: F (ornamented start)
  { bar: 0, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  { bar: 0, beat: 1, sub: 0, degree: 5, octave: 5, duration: '8n' }, // C5
  { bar: 0, beat: 1, sub: 0.5, degree: 6, octave: 5, duration: '8n' }, // D5
  { bar: 0, beat: 2, sub: 0, degree: 1, octave: 5, duration: '2n' }, // F5
  // Bar 1: Dm
  { bar: 1, beat: 0, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 1, beat: 1, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  { bar: 1, beat: 2, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  // Bar 2: Bb
  { bar: 2, beat: 0, sub: 0, degree: 4, octave: 4, duration: '4n.' }, // Bb4
  { bar: 2, beat: 1, sub: 0.5, degree: 3, octave: 4, duration: '8n' }, // A4
  { bar: 2, beat: 2, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 2, beat: 3, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  // Bar 3: C
  { bar: 3, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  { bar: 3, beat: 2, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  // Bar 4: F
  { bar: 4, beat: 0, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  { bar: 4, beat: 1, sub: 0, degree: 5, octave: 5, duration: '4n' }, // C5
  { bar: 4, beat: 2, sub: 0, degree: 1, octave: 5, duration: '4n' }, // F5
  { bar: 4, beat: 3, sub: 0, degree: 5, octave: 5, duration: '4n' }, // C5
  // Bar 5: Am
  { bar: 5, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  { bar: 5, beat: 2, sub: 0, degree: 7, octave: 4, duration: '2n' }, // E4
  // Bar 6: Bb
  { bar: 6, beat: 0, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 6, beat: 1, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 6, beat: 2, sub: 0, degree: 1, octave: 4, duration: '2n' }, // F4
  // Bar 7: C
  { bar: 7, beat: 0, sub: 0, degree: 2, octave: 4, duration: '4n.' }, // G4
  { bar: 7, beat: 1, sub: 0.5, degree: 1, octave: 4, duration: '8n' }, // F4
  { bar: 7, beat: 2, sub: 0, degree: 7, octave: 4, duration: '2n' }, // E4
  // Bar 8: Dm
  { bar: 8, beat: 0, sub: 0, degree: 6, octave: 5, duration: '2n' }, // D5
  { bar: 8, beat: 2, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  // Bar 9: Bb
  { bar: 9, beat: 0, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 9, beat: 1, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  { bar: 9, beat: 2, sub: 0, degree: 6, octave: 4, duration: '2n' }, // D4
  // Bar 10: F
  { bar: 10, beat: 0, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  { bar: 10, beat: 2, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  // Bar 11: C
  { bar: 11, beat: 0, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  { bar: 11, beat: 2, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  // Bar 12: Bb
  { bar: 12, beat: 0, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 12, beat: 1, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 12, beat: 2, sub: 0, degree: 1, octave: 4, duration: '2n' }, // F4
  // Bar 13: C
  { bar: 13, beat: 0, sub: 0, degree: 2, octave: 4, duration: '4n' }, // G4
  { bar: 13, beat: 1, sub: 0, degree: 7, octave: 4, duration: '4n' }, // E4
  { bar: 13, beat: 2, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  // Bar 14: F
  { bar: 14, beat: 0, sub: 0, degree: 1, octave: 4, duration: '2n' }, // F4
  { bar: 14, beat: 2, sub: 0, degree: 5, octave: 4, duration: '2n' }, // C4
  // Bar 15: F
  { bar: 15, beat: 0, sub: 0, degree: 1, octave: 4, duration: '2n.' }, // F4
];

const VARIANT_B: readonly MelodyNote[] = [
  // Bar 0: F (starts grounded, reflective)
  { bar: 0, beat: 0, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  { bar: 0, beat: 2, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  { bar: 0, beat: 3, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  // Bar 1: Dm
  { bar: 1, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n.' }, // D4
  { bar: 1, beat: 3, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  // Bar 2: Bb
  { bar: 2, beat: 0, sub: 0, degree: 4, octave: 4, duration: '2n' }, // Bb4
  { bar: 2, beat: 2, sub: 0, degree: 6, octave: 4, duration: '2n' }, // D4
  // Bar 3: C
  { bar: 3, beat: 0, sub: 0, degree: 5, octave: 4, duration: '1m' }, // C4
  // Bar 4: F
  { bar: 4, beat: 0, sub: 0, degree: 1, octave: 4, duration: '2n' }, // F4
  { bar: 4, beat: 2, sub: 0, degree: 7, octave: 4, duration: '4n' }, // E4
  { bar: 4, beat: 3, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  // Bar 5: Am
  { bar: 5, beat: 0, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  { bar: 5, beat: 2, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  // Bar 6: Bb
  { bar: 6, beat: 0, sub: 0, degree: 4, octave: 4, duration: '4n' }, // Bb4
  { bar: 6, beat: 1, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 6, beat: 2, sub: 0, degree: 1, octave: 4, duration: '2n' }, // F4
  // Bar 7: C
  { bar: 7, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n' }, // E4
  { bar: 7, beat: 2, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  // Bar 8: Dm
  { bar: 8, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  { bar: 8, beat: 2, sub: 0, degree: 6, octave: 4, duration: '4n' }, // D4
  { bar: 8, beat: 3, sub: 0, degree: 1, octave: 4, duration: '4n' }, // F4
  // Bar 9: Bb
  { bar: 9, beat: 0, sub: 0, degree: 4, octave: 4, duration: '2n' }, // Bb4
  { bar: 9, beat: 2, sub: 0, degree: 6, octave: 4, duration: '2n' }, // D4
  // Bar 10: F
  { bar: 10, beat: 0, sub: 0, degree: 5, octave: 5, duration: '2n.' }, // C5
  { bar: 10, beat: 3, sub: 0, degree: 3, octave: 4, duration: '4n' }, // A4
  // Bar 11: C
  { bar: 11, beat: 0, sub: 0, degree: 7, octave: 4, duration: '2n' }, // E4
  { bar: 11, beat: 2, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  // Bar 12: Bb
  { bar: 12, beat: 0, sub: 0, degree: 6, octave: 4, duration: '2n' }, // D4
  { bar: 12, beat: 2, sub: 0, degree: 4, octave: 4, duration: '2n' }, // Bb4
  // Bar 13: C
  { bar: 13, beat: 0, sub: 0, degree: 5, octave: 5, duration: '2n' }, // C5
  { bar: 13, beat: 2, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  // Bar 14: F
  { bar: 14, beat: 0, sub: 0, degree: 3, octave: 4, duration: '2n' }, // A4
  { bar: 14, beat: 2, sub: 0, degree: 2, octave: 4, duration: '2n' }, // G4
  // Bar 15: F
  { bar: 15, beat: 0, sub: 0, degree: 1, octave: 4, duration: '1m' }, // F4
];

/**
 * Converts scale degree and octave into absolute diatonic degree index where F4 = 0.
 * In F major: 1=F, 2=G, 3=A, 4=Bb, 5=C, 6=D, 7=E.
 * In scientific pitch notation, C4..E4 are in octave 4 but are lower in pitch than F4 (negative indices),
 * while C5..E5 are in octave 5 (higher in pitch than F4, positive indices).
 */
export function getAbsoluteDegree(degree: number, octave: number): number {
  if (degree >= 1 && degree <= 4) {
    return (octave - 4) * 7 + (degree - 1);
  } else {
    return (octave - 5) * 7 + (degree - 1);
  }
}

/**
 * Maps an absolute diatonic degree index (0 = F4) back to a MIDI pitch number.
 */
function absoluteDegreeToMidi(absDeg: number): number {
  const degIndex = ((absDeg % 7) + 7) % 7;
  const octaveOffset = Math.floor(absDeg / 7);
  // Diatonic pitch semitones from C: [F=5, G=7, A=9, Bb=10, C=0, D=2, E=4]
  const DEGREE_SEMITONES_F = [5, 7, 9, 10, 0, 2, 4];
  const oct = (degIndex < 4 ? 4 : 5) + octaveOffset;
  return (oct + 1) * 12 + DEGREE_SEMITONES_F[degIndex];
}

/**
 * Transforms Heads scale degree into Tails inverted note:
 *
 * HOW THE GAME'S THEME (TWO SIDES OF ONE COIN) LIVES IN THE MUSIC:
 * Sol (Heads) and Lune (Tails) are bound together by an exact conservation law.
 * In Chapter 2 ("The Roots"), the Tails melody is the mathematical diatonic inversion of
 * Sol's melody flipped across the opening pivot note (A4, the shared mediant of F major
 * and dominant of D natural minor).
 *
 * Voiced in the grounded D4–D5 octave (an octave lower than Chapter 1's celesta, fitting
 * the earthy subterranean setting), every inverted note landing on a beat is snapped
 * to the nearest chord tone of that bar's shared chord, while off-beat passing tones
 * are preserved if they are within a diatonic step (<= 2 semitones) of the harmony.
 */
export function invertAndSnap(
  note: MelodyNote,
  pivotAbsDegree: number,
  chord: ChordInfo
): { noteName: string; duration: string; velocity: number } {
  const headsAbs = getAbsoluteDegree(note.degree, note.octave);
  const intervalFromPivot = headsAbs - pivotAbsDegree;
  // Diatonic inversion: flip interval around the pivot note
  const invertedAbs = pivotAbsDegree - intervalFromPivot;

  const candidateMidi = absoluteDegreeToMidi(invertedAbs);

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
    const isStepAway = chord.tones.some((ct) => {
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

export class Chapter2Theme {
  private readonly mixer: Mixer;
  private isPlaying = false;
  private isResolving = false;

  // HEADS synths (woody marimba mallet, acoustic bass roots, gentle pulse & shaker)
  private headsMalletSynth: Tone.PolySynth<Tone.FMSynth>;
  private headsBassSynth: Tone.Synth;
  private headsPulseSynth: Tone.MembraneSynth;
  private headsShakerSynth: Tone.NoiseSynth;

  // TAILS synths (low glassy bells, dark warm pad)
  private tailsBellSynth: Tone.PolySynth<Tone.FMSynth>;
  private tailsPadSynth: Tone.PolySynth<Tone.Synth>;

  // UNISON choir pad synth
  private unisonPadSynth: Tone.PolySynth<Tone.Synth>;

  // Transport event parts
  private parts: Tone.Part[] = [];

  constructor(mixer: Mixer) {
    this.mixer = mixer;

    // HEADS LAYER: Woody marimba mallet + low plucked acoustic bass + soft pulse & shaker
    this.headsMalletSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.0,
      modulationIndex: 1.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.36, sustain: 0.01, release: 0.28 },
      modulationEnvelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.14 },
    }).connect(this.mixer.headsChannel);
    this.headsMalletSynth.volume.value = -4;

    this.headsBassSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.85, sustain: 0.25, release: 0.7 },
      volume: -6,
    }).connect(this.mixer.headsChannel);

    this.headsPulseSynth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 1.2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.006, decay: 0.32, sustain: 0, release: 0.2 },
      volume: -18,
    }).connect(this.mixer.headsChannel);

    this.headsShakerSynth = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.004, decay: 0.045, sustain: 0 },
      volume: -24,
    }).connect(this.mixer.headsChannel);

    // TAILS LAYER: Low glassy bells (harmonicity ~3.5, longer decay) + dark warm pad
    this.tailsBellSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.51,
      modulationIndex: 2.8,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.008, decay: 1.4, sustain: 0.05, release: 1.6 },
      modulationEnvelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.5 },
    }).connect(this.mixer.tailsChannel);
    this.tailsBellSynth.volume.value = -5;

    this.tailsPadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.6, decay: 1.2, sustain: 0.65, release: 2.2 },
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

      // Heads woody marimba mallet
      this.headsMalletSynth.triggerAttackRelease(
        event.headsNote,
        event.duration,
        time,
        event.headsVel
      );

      // Tails low glassy bells (inverted melody, snapped to harmony)
      this.tailsBellSynth.triggerAttackRelease(
        event.tailsNote,
        event.duration,
        time,
        event.tailsVel
      );

      // Unison choir pad: plays both melodies simultaneously
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

    // Harmonic & rhythmic accompaniment: bass roots, beat-1 pulse, off-beat shaker, and dark pad
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

      // Heads low plucked acoustic bass
      this.headsBassSynth.triggerAttackRelease(chord.rootNote, '1m', time, 0.45);

      // Heads gentle pulse on beat 1 (soft membrane tap)
      this.headsPulseSynth.triggerAttackRelease(chord.rootNote, '8n', time, 0.32);

      // Heads subtle rhythmic shaker on off-beats
      const baseSec = Tone.Time(time).toSeconds();
      const quarterSec = Tone.Time('4n').toSeconds();
      this.headsShakerSynth.triggerAttackRelease('16n', baseSec + quarterSec * 0.5, 0.12);
      this.headsShakerSynth.triggerAttackRelease('16n', baseSec + quarterSec * 1.5, 0.16);
      this.headsShakerSynth.triggerAttackRelease('16n', baseSec + quarterSec * 2.5, 0.12);
      this.headsShakerSynth.triggerAttackRelease('16n', baseSec + quarterSec * 3.5, 0.16);

      // Tails slow sustaining dark warm chord pad
      this.tailsPadSynth.triggerAttackRelease([...chord.padNotes], '1m', time, 0.26);
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

    Tone.getTransport().bpm.value = 72;
    Tone.getTransport().timeSignature = 4;
    Tone.getTransport().loop = true;
    Tone.getTransport().loopStart = '0:0:0';
    Tone.getTransport().loopEnd = '64:0:0';

    for (const part of this.parts) {
      part.start(0);
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

  /**
   * LEVEL COMPLETE RESOLUTION (§6.1):
   * At the next beat, both melodic layers resolve onto one shared F major chord:
   * Heads plays a warm lower voicing on woody marimba, Tails plays low glassy bells voicing.
   * Rings for ~2 seconds, then resumes the loop from phrase start (0:0:0).
   */
  resolve(): void {
    if (!this.isPlaying || this.isResolving) return;
    this.isResolving = true;

    const transport = Tone.getTransport();
    const nowTime = Tone.now();
    const nextBeatTime = nowTime + 0.08;

    // Heads warm F major voicing on woody marimba: [F3, C4, A4, C5]
    const headsChord = ['F3', 'C4', 'A4', 'C5'];
    // Tails low glassy bells F major voicing: [F4, A4, C5, F5]
    const tailsChord = ['F4', 'A4', 'C5', 'F5'];

    this.headsMalletSynth.triggerAttackRelease(headsChord, '2n', nextBeatTime, 0.42);
    this.tailsBellSynth.triggerAttackRelease(tailsChord, '2n', nextBeatTime, 0.38);

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
