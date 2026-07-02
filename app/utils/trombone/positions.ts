export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type Accidental = 'flat' | 'sharp' | null
export type SlidePosition = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface TromboneNote {
  /** Unique id, e.g. 'Bb2' */
  id: string
  letter: Letter
  accidental: Accidental
  /** Scientific pitch octave (C4 = middle C) */
  octave: 2 | 3 | 4
  /** Display spelling, e.g. 'B♭' */
  display: string
  /** Primary slide position */
  position: SlidePosition
  /** MIDI note number (C4 = 60) */
  midi: number
}

/**
 * Concert-pitch working range for tenor trombone, E2–F4, primary positions
 * only. Derived from the 1st-position partials B♭2, F3, B♭3, D4, F4; each
 * position lowers a partial by one semitone. Verified by
 * scripts/verify-trombone.ts.
 */
export const NOTES: TromboneNote[] = [
  { id: 'E2',  letter: 'E', accidental: null,    octave: 2, display: 'E',  position: 7, midi: 40 },
  { id: 'F2',  letter: 'F', accidental: null,    octave: 2, display: 'F',  position: 6, midi: 41 },
  { id: 'Fs2', letter: 'F', accidental: 'sharp', octave: 2, display: 'F♯', position: 5, midi: 42 },
  { id: 'G2',  letter: 'G', accidental: null,    octave: 2, display: 'G',  position: 4, midi: 43 },
  { id: 'Ab2', letter: 'A', accidental: 'flat',  octave: 2, display: 'A♭', position: 3, midi: 44 },
  { id: 'A2',  letter: 'A', accidental: null,    octave: 2, display: 'A',  position: 2, midi: 45 },
  { id: 'Bb2', letter: 'B', accidental: 'flat',  octave: 2, display: 'B♭', position: 1, midi: 46 },
  { id: 'B2',  letter: 'B', accidental: null,    octave: 2, display: 'B',  position: 7, midi: 47 },
  { id: 'C3',  letter: 'C', accidental: null,    octave: 3, display: 'C',  position: 6, midi: 48 },
  { id: 'Cs3', letter: 'C', accidental: 'sharp', octave: 3, display: 'C♯', position: 5, midi: 49 },
  { id: 'D3',  letter: 'D', accidental: null,    octave: 3, display: 'D',  position: 4, midi: 50 },
  { id: 'Eb3', letter: 'E', accidental: 'flat',  octave: 3, display: 'E♭', position: 3, midi: 51 },
  { id: 'E3',  letter: 'E', accidental: null,    octave: 3, display: 'E',  position: 2, midi: 52 },
  { id: 'F3',  letter: 'F', accidental: null,    octave: 3, display: 'F',  position: 1, midi: 53 },
  { id: 'Fs3', letter: 'F', accidental: 'sharp', octave: 3, display: 'F♯', position: 5, midi: 54 },
  { id: 'G3',  letter: 'G', accidental: null,    octave: 3, display: 'G',  position: 4, midi: 55 },
  { id: 'Ab3', letter: 'A', accidental: 'flat',  octave: 3, display: 'A♭', position: 3, midi: 56 },
  { id: 'A3',  letter: 'A', accidental: null,    octave: 3, display: 'A',  position: 2, midi: 57 },
  { id: 'Bb3', letter: 'B', accidental: 'flat',  octave: 3, display: 'B♭', position: 1, midi: 58 },
  { id: 'B3',  letter: 'B', accidental: null,    octave: 3, display: 'B',  position: 4, midi: 59 },
  { id: 'C4',  letter: 'C', accidental: null,    octave: 4, display: 'C',  position: 3, midi: 60 },
  { id: 'Cs4', letter: 'C', accidental: 'sharp', octave: 4, display: 'C♯', position: 2, midi: 61 },
  { id: 'D4',  letter: 'D', accidental: null,    octave: 4, display: 'D',  position: 1, midi: 62 },
  { id: 'Eb4', letter: 'E', accidental: 'flat',  octave: 4, display: 'E♭', position: 3, midi: 63 },
  { id: 'E4',  letter: 'E', accidental: null,    octave: 4, display: 'E',  position: 2, midi: 64 },
  { id: 'F4',  letter: 'F', accidental: null,    octave: 4, display: 'F',  position: 1, midi: 65 },
]
