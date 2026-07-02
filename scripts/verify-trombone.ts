import { NOTES } from '../app/utils/trombone/positions'

let failures = 0
function check(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error('FAIL:', msg) }
}

// --- positions.ts ---
const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// MIDI of the usable 1st-position partials: Bb2, F3, Bb3, D4, F4
const PARTIALS = [46, 53, 58, 62, 65]

check(NOTES.length === 26, `expected 26 notes, got ${NOTES.length}`)
check(new Set(NOTES.map(n => n.id)).size === NOTES.length, 'duplicate note ids')
check(NOTES[0]!.id === 'E2' && NOTES[25]!.id === 'F4', 'range must be E2..F4')

for (let i = 0; i < NOTES.length; i++) {
  const n = NOTES[i]!
  // ascending, chromatic, in range
  check(n.midi === 40 + i, `${n.id}: midi ${n.midi}, expected ${40 + i}`)
  // midi matches spelling
  const acc = n.accidental === 'flat' ? -1 : n.accidental === 'sharp' ? 1 : 0
  const midi = (n.octave + 1) * 12 + LETTER_SEMITONE[n.letter]! + acc
  check(midi === n.midi, `${n.id}: spelling gives midi ${midi}, field says ${n.midi}`)
  // primary position = smallest position reaching this pitch from any partial
  const valid = PARTIALS.map(p => p - n.midi + 1).filter(pos => pos >= 1 && pos <= 7)
  check(valid.length > 0 && Math.min(...valid) === n.position,
    `${n.id}: position ${n.position}, harmonic series gives ${JSON.stringify(valid)}`)
  // display matches spelling
  const display = n.letter + (n.accidental === 'flat' ? '♭' : n.accidental === 'sharp' ? '♯' : '')
  check(n.display === display, `${n.id}: display '${n.display}', expected '${display}'`)
}

console.log(failures === 0 ? 'verify-trombone: all checks passed' : `verify-trombone: ${failures} FAILURES`)
process.exit(failures ? 1 : 0)
