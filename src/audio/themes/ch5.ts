import type { Mixer } from '../mixer';
import { C, Chapter3Theme, mk, type Score } from './ch3';

/**
 * Chapter 5, The Dark: the slowest tune in the game, leaning on the minor chords, with long
 * silences that the embers (drips) fill. Sounded a fourth down, in C major / A minor.
 */
const F = C('F', [5, 9, 0], 'F1', ['F3', 'A3', 'C4']);
const Cmaj = C('C', [0, 4, 7], 'C2', ['E3', 'G3', 'C4']);
const Dm = C('Dm', [2, 5, 9], 'D1', ['D3', 'F3', 'A3']);
const Bb = C('Bb', [10, 2, 5], 'Bb1', ['D3', 'F3', 'Bb3']);
const Gm = C('Gm', [7, 10, 2], 'G1', ['D3', 'G3', 'Bb3']);
const Am = C('Am', [9, 0, 4], 'A1', ['E3', 'A3', 'C4']);

const PHRASE_A = mk([
  [0, 0, 0, 6, 5, '1m'],
  [1, 0, 0, 1, 4, '2n'], [1, 2, 0, 3, 4, '2n'],
  [2, 0, 0, 4, 4, '1m'],
  [3, 2, 0, 2, 4, '2n'],
  [4, 0, 0, 6, 5, '2n.'], [4, 3, 0, 5, 5, '4n'],
  [5, 0, 0, 3, 4, '1m'],
  [6, 0, 0, 2, 4, '2n'], [6, 2, 0, 4, 4, '2n'],
  [7, 0, 0, 1, 4, '1m'],
  [8, 0, 0, 6, 5, '2n'], [8, 2, 0, 1, 5, '2n'],
  [9, 0, 0, 7, 5, '1m'],
  [10, 0, 0, 4, 4, '2n.'], [10, 3, 0, 6, 5, '4n'],
  [11, 0, 0, 5, 5, '1m'],
  [12, 0, 0, 2, 4, '2n'], [12, 2, 0, 4, 4, '2n'],
  [13, 0, 0, 3, 4, '1m'],
  [14, 0, 0, 2, 4, '2n'], [14, 2, 0, 7, 5, '2n'],
  [15, 0, 0, 6, 5, '1m'],
]);
const PHRASE_B = mk([
  [0, 0, 0, 3, 4, '2n'], [0, 2, 0, 6, 5, '2n'],
  [1, 0, 0, 1, 5, '1m'],
  [2, 2, 0, 4, 4, '2n'],
  [3, 0, 0, 3, 4, '1m'],
  [4, 0, 0, 2, 4, '2n'], [4, 2, 0, 4, 4, '4n'], [4, 3, 0, 6, 5, '4n'],
  [5, 0, 0, 5, 5, '1m'],
  [6, 2, 0, 3, 4, '2n'],
  [7, 0, 0, 2, 4, '1m'],
  [8, 0, 0, 6, 5, '1m'],
  [9, 0, 0, 5, 5, '2n'], [9, 2, 0, 3, 4, '2n'],
  [10, 0, 0, 4, 4, '1m'],
  [11, 2, 0, 1, 4, '2n'],
  [12, 0, 0, 2, 4, '1m'],
  [13, 0, 0, 3, 4, '2n'], [13, 2, 0, 1, 4, '2n'],
  [14, 0, 0, 7, 5, '1m'],
  [15, 0, 0, 6, 5, '1m'],
]);

const DARK: Score = {
  transpose: -5,
  bpm: 58,
  progression: [Dm, F, Bb, Dm, Dm, Am, Bb, F, Dm, Cmaj, Bb, Cmaj, Gm, Am, Cmaj, Dm],
  phrases: [PHRASE_A, PHRASE_B],
  drips: [[1, 3, 'A6'], [2, 1.5, 'D7'], [3, 0.5, 'F6'], [6, 0.5, 'A6'], [7, 2.5, 'D7'], [9, 3, 'F6'], [11, 0.5, 'A6'], [12, 3.5, 'D7'], [15, 2, 'A6']],
};

export class Chapter5Theme extends Chapter3Theme {
  constructor(mixer: Mixer) { super(mixer, DARK); }
}
