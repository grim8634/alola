import type { TromboneNote } from './positions'

type StaffNote = Pick<TromboneNote, 'letter' | 'octave'>

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

/** Layout constants for the staff SVG. */
export const STAFF = {
  viewBox: '0 0 260 140',
  left: 20,
  right: 240,
  /** y of the bottom staff line (G2) */
  bottomLineY: 112,
  /** half the gap between staff lines = one diatonic step */
  halfGap: 8,
  noteX: 150,
  ledgerHalfWidth: 16,
} as const

/** y coords of the 5 staff lines, top (A3) to bottom (G2). */
export const STAFF_LINE_YS = [48, 64, 80, 96, 112]

/**
 * Diatonic steps above the bottom staff line. Bass clef: G2 = 0 (bottom
 * line), A3 = 8 (top line), E2 = -2 (first ledger below), C4 = 10 (first
 * ledger above).
 */
export function staffStep(note: StaffNote): number {
  return note.octave * 7 + LETTER_INDEX[note.letter]! - 18
}

export function noteY(note: StaffNote): number {
  return STAFF.bottomLineY - staffStep(note) * STAFF.halfGap
}

/** y of each ledger line this note needs (empty for on-staff notes). */
export function ledgerYs(note: StaffNote): number[] {
  const step = staffStep(note)
  const ys: number[] = []
  for (let s = -2; s >= step; s -= 2) ys.push(STAFF.bottomLineY - s * STAFF.halfGap)
  for (let s = 10; s <= step; s += 2) ys.push(STAFF.bottomLineY - s * STAFF.halfGap)
  return ys
}
