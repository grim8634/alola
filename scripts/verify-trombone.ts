import { NOTES } from '../app/utils/trombone/positions'
import { staffStep, noteY, ledgerYs, STAFF, STAFF_LINE_YS } from '../app/utils/trombone/notation'
import { createQuiz, POSITION_CHOICES } from '../app/utils/trombone/quiz'

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

// --- notation.ts ---
const stepCases: Array<[string, number]> = [
  ['E2', -2], ['F2', -1], ['G2', 0], ['B2', 2], ['D3', 4], ['F3', 6],
  ['A3', 8], ['B3', 9], ['C4', 10], ['D4', 11], ['F4', 13],
]
for (const [id, expected] of stepCases) {
  const n = NOTES.find(x => x.id === id)!
  check(staffStep(n) === expected, `staffStep(${id}) = ${staffStep(n)}, expected ${expected}`)
}
// noteY: on-line notes must land exactly on a staff line
for (const id of ['G2', 'B2', 'D3', 'F3', 'A3']) {
  const n = NOTES.find(x => x.id === id)!
  check(STAFF_LINE_YS.includes(noteY(n)), `noteY(${id}) = ${noteY(n)} not on a staff line`)
}
// ledger lines
const ledgerCases: Array<[string, number[]]> = [
  ['E2', [128]], ['F2', []], ['G3', []], ['B3', []],
  ['C4', [32]], ['D4', [32]], ['E4', [32, 16]], ['F4', [32, 16]],
]
for (const [id, expected] of ledgerCases) {
  const n = NOTES.find(x => x.id === id)!
  check(JSON.stringify(ledgerYs(n)) === JSON.stringify(expected),
    `ledgerYs(${id}) = ${JSON.stringify(ledgerYs(n))}, expected ${JSON.stringify(expected)}`)
}
// every note fits inside the viewBox with room for the notehead (ry 5.5)
for (const n of NOTES) {
  const y = noteY(n)
  check(y >= 6 && y <= 134, `${n.id}: noteY ${y} outside viewBox 0..140`)
}
check(STAFF.noteX === 150, 'noteX moved — update Staff.vue accidental offset if intentional')

// --- quiz.ts ---
const quiz = createQuiz()
let prevId: string | null = null
let sawName = false
let sawPosition = false
for (let i = 0; i < 300; i++) {
  const q = quiz.next()
  check(q.note.id !== prevId, `question ${i}: immediate repeat of ${q.note.id}`)
  prevId = q.note.id
  check(q.choices.includes(q.answer), `question ${i}: answer '${q.answer}' not in choices`)
  if (q.mode === 'name') {
    sawName = true
    check(q.choices.length === 4, `question ${i}: name mode has ${q.choices.length} choices`)
    check(new Set(q.choices).size === 4, `question ${i}: duplicate name choices`)
    check(q.answer === q.note.display, `question ${i}: name answer mismatch`)
  } else {
    sawPosition = true
    check(JSON.stringify([...q.choices].sort()) === JSON.stringify([...POSITION_CHOICES].sort()),
      `question ${i}: position choices wrong`)
    check(q.answer === String(q.note.position), `question ${i}: position answer mismatch`)
  }
}
check(sawName && sawPosition, 'both modes must appear over 300 questions')

// weighting: wrong boosts, correct decays, floor and cap respected
const q2 = createQuiz()
const first = q2.next()
const w0 = q2.weightOf(first.note.id)
q2.submit(first, '__wrong__')
check(q2.weightOf(first.note.id) === w0 + 4, 'wrong answer must boost weight by 4')
q2.submit(first, first.answer)
check(q2.weightOf(first.note.id) === w0 + 3, 'correct answer must decay weight by 1')
for (let i = 0; i < 10; i++) q2.submit(first, '__wrong__')
check(q2.weightOf(first.note.id) === 12, 'weight must cap at 12')
for (let i = 0; i < 30; i++) q2.submit(first, first.answer)
check(q2.weightOf(first.note.id) === 1, 'weight must floor at baseline 1')

console.log(failures === 0 ? 'verify-trombone: all checks passed' : `verify-trombone: ${failures} FAILURES`)
process.exit(failures ? 1 : 0)
