# Trombone Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A quiz page at `/trombone` that shows a note on a bass-clef staff and drills the user on note names and tenor-trombone slide positions, with instant feedback and a slide-position diagram.

**Architecture:** Thin Nuxt page (`app/pages/trombone.vue`) over pure-logic modules in `app/utils/trombone/` (note data, staff geometry, quiz engine) and two SVG components in `app/components/Trombone/`. Data flows one way: `positions.ts` → `quiz.ts` → page → `Staff.vue`/`Slide.vue`.

**Tech Stack:** Nuxt 4, Vue 3 (`<script setup>` + TypeScript), Tailwind CSS 3 with the site's custom tokens, inline SVG. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-02-trombone-trainer-design.md`

**No test framework** is configured (per `CLAUDE.md`). Instead, a standalone verification script `scripts/verify-trombone.ts` (run with `npx tsx`, already a devDependency) asserts the pure-logic modules, and the UI tasks are verified against the dev server with `curl` + visual check.

## Global Constraints

- Route is exactly `/trombone`; page is NOT linked from any nav/index page.
- Primary slide position only — one position per note, per the chart in Task 1 (copied verbatim from the spec).
- Range: E2–F4 (26 notes). Data-driven; do not hardcode notes outside `positions.ts`.
- Dark-theme design tokens only: `surface`/`surface-raised`, `ink`/`ink-muted`/`ink-faint`, `accent` (see `tailwind.config.js`). Fonts: `font-display` (Syne) for headings/buttons, `font-body` (Lora) for prose.
- Follow the page pattern of `app/pages/tic-tac-toe.vue`: accent uppercase label → `h1` → `reveal`/`reveal-d*` animations → `h-px bg-ink-faint/20 rule-reveal` rule.
- All components use `<script setup lang="ts">`.
- Accidental glyphs are the Unicode characters `♭` (U+266D) and `♯` (U+266F) everywhere (data, buttons, SVG text).
- No session persistence — state resets on reload.

---

## File Structure

- **Create:** `app/utils/trombone/positions.ts` — authoritative note dataset (26 notes), no dependencies
- **Create:** `app/utils/trombone/notation.ts` — pure note → staff-geometry helpers, depends on note shape only
- **Create:** `app/utils/trombone/quiz.ts` — question generation + wrong-answer weighting, depends on `positions.ts`
- **Create:** `app/components/Trombone/Staff.vue` — bass-clef staff + note SVG, depends on `notation.ts`
- **Create:** `app/components/Trombone/Slide.vue` — slide diagram with highlighted position, depends on a number prop only
- **Create:** `app/pages/trombone.vue` — quiz loop + score/streak UI
- **Create:** `scripts/verify-trombone.ts` — assertion script for the three utils modules (kept in repo as the executable spec of the data)

---

### Task 1: Note dataset (`positions.ts`) + verification script

**Files:**
- Create: `app/utils/trombone/positions.ts`
- Create: `scripts/verify-trombone.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface TromboneNote { id: string; letter: Letter; accidental: Accidental; octave: 2|3|4; display: string; position: 1|2|3|4|5|6|7; midi: number }`, `type Letter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'`, `type Accidental = 'flat'|'sharp'|null`, `const NOTES: TromboneNote[]` (26 entries, E2→F4 ascending)

- [ ] **Step 1: Write `app/utils/trombone/positions.ts`**

```ts
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
```

- [ ] **Step 2: Write `scripts/verify-trombone.ts`**

This independently re-derives every field (MIDI from spelling, position from the harmonic series) so a typo in the table cannot pass.

```ts
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
```

- [ ] **Step 3: Run the verification script**

Run: `cd /home/graemel/workspace/alola && npx tsx scripts/verify-trombone.ts`
Expected: `verify-trombone: all checks passed`, exit code 0. If any FAIL lines print, fix the data in `positions.ts` (the script's derivations are the source of truth for pitch math; the spec's chart is the source of truth for positions — they must agree).

- [ ] **Step 4: Commit**

```bash
git add app/utils/trombone/positions.ts scripts/verify-trombone.ts
git commit -m "feat(trombone): note dataset with verified slide positions"
```

---

### Task 2: Staff geometry (`notation.ts`)

**Files:**
- Create: `app/utils/trombone/notation.ts`
- Modify: `scripts/verify-trombone.ts` (append geometry checks)

**Interfaces:**
- Consumes: `TromboneNote` shape from Task 1 (`letter`, `octave` fields only)
- Produces:
  - `const STAFF = { viewBox: '0 0 260 140', left: 20, right: 240, bottomLineY: 112, halfGap: 8, noteX: 150, ledgerHalfWidth: 16 }`
  - `const STAFF_LINE_YS: number[]` — `[48, 64, 80, 96, 112]`, top→bottom
  - `staffStep(note: Pick<TromboneNote, 'letter'|'octave'>): number` — diatonic steps above bottom line G2
  - `noteY(note: Pick<TromboneNote, 'letter'|'octave'>): number` — SVG y for the notehead
  - `ledgerYs(note: Pick<TromboneNote, 'letter'|'octave'>): number[]` — SVG y for each ledger line needed

- [ ] **Step 1: Write `app/utils/trombone/notation.ts`**

```ts
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
```

- [ ] **Step 2: Append geometry checks to `scripts/verify-trombone.ts`**

Insert before the final `console.log` line:

```ts
// --- notation.ts ---
import { staffStep, noteY, ledgerYs, STAFF, STAFF_LINE_YS } from '../app/utils/trombone/notation'

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
```

(Move the `import` to the top of the file with the other import — ES modules hoist imports, but keep the file tidy.)

- [ ] **Step 3: Run the verification script**

Run: `cd /home/graemel/workspace/alola && npx tsx scripts/verify-trombone.ts`
Expected: `verify-trombone: all checks passed`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/utils/trombone/notation.ts scripts/verify-trombone.ts
git commit -m "feat(trombone): bass-clef staff geometry helpers"
```

---

### Task 3: Quiz engine (`quiz.ts`)

**Files:**
- Create: `app/utils/trombone/quiz.ts`
- Modify: `scripts/verify-trombone.ts` (append quiz checks)

**Interfaces:**
- Consumes: `NOTES`, `TromboneNote` from Task 1
- Produces:
  - `type QuizMode = 'name' | 'position'`
  - `interface Question { note: TromboneNote; mode: QuizMode; choices: string[]; answer: string }` — `choices` are display strings for `'name'` (4 options), `'1'`–`'7'` for `'position'`; `answer` is always a member of `choices`
  - `const POSITION_CHOICES: string[]` — `['1'..'7']`
  - `createQuiz(notes?: TromboneNote[]): { next(): Question; submit(q: Question, choice: string): boolean; weightOf(id: string): number }`

- [ ] **Step 1: Write `app/utils/trombone/quiz.ts`**

```ts
import { NOTES, type TromboneNote } from './positions'

export type QuizMode = 'name' | 'position'

export interface Question {
  note: TromboneNote
  mode: QuizMode
  /** Button labels: display names for 'name' (4), '1'–'7' for 'position'. */
  choices: string[]
  /** The correct choice — always a member of choices. */
  answer: string
}

export const POSITION_CHOICES = ['1', '2', '3', '4', '5', '6', '7']

const BASE_WEIGHT = 1
const WRONG_BOOST = 4
const MAX_WEIGHT = 12

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/**
 * Session-only quiz over the note set. Wrong answers boost a note's weight
 * so it reappears more often; correct answers decay it back to baseline.
 */
export function createQuiz(notes: TromboneNote[] = NOTES) {
  const weights = new Map(notes.map(n => [n.id, BASE_WEIGHT]))
  let lastId: string | null = null

  function pickNote(): TromboneNote {
    const pool = notes.length > 1 ? notes.filter(n => n.id !== lastId) : notes
    const total = pool.reduce((sum, n) => sum + weights.get(n.id)!, 0)
    let r = Math.random() * total
    for (const n of pool) {
      r -= weights.get(n.id)!
      if (r < 0) return n
    }
    return pool[pool.length - 1]!
  }

  function nameChoices(note: TromboneNote): string[] {
    const others = [...new Set(notes.map(n => n.display))].filter(d => d !== note.display)
    return shuffle([note.display, ...shuffle(others).slice(0, 3)])
  }

  return {
    next(): Question {
      const note = pickNote()
      lastId = note.id
      const mode: QuizMode = Math.random() < 0.5 ? 'name' : 'position'
      return mode === 'name'
        ? { note, mode, choices: nameChoices(note), answer: note.display }
        : { note, mode, choices: [...POSITION_CHOICES], answer: String(note.position) }
    },
    submit(question: Question, choice: string): boolean {
      const correct = choice === question.answer
      const w = weights.get(question.note.id)!
      weights.set(
        question.note.id,
        correct ? Math.max(BASE_WEIGHT, w - 1) : Math.min(MAX_WEIGHT, w + WRONG_BOOST),
      )
      return correct
    },
    /** Exposed for verification only. */
    weightOf(id: string): number {
      return weights.get(id) ?? 0
    },
  }
}
```

- [ ] **Step 2: Append quiz checks to `scripts/verify-trombone.ts`**

Insert before the final `console.log` line (import goes at the top):

```ts
// --- quiz.ts ---
import { createQuiz, POSITION_CHOICES } from '../app/utils/trombone/quiz'

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
```

- [ ] **Step 3: Run the verification script**

Run: `cd /home/graemel/workspace/alola && npx tsx scripts/verify-trombone.ts`
Expected: `verify-trombone: all checks passed`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/utils/trombone/quiz.ts scripts/verify-trombone.ts
git commit -m "feat(trombone): quiz engine with wrong-answer weighting"
```

---

### Task 4: SVG components + static page scaffold

**Files:**
- Create: `app/components/Trombone/Staff.vue`
- Create: `app/components/Trombone/Slide.vue`
- Create: `app/pages/trombone.vue` (static scaffold — quiz wiring comes in Task 5)

**Interfaces:**
- Consumes: `NOTES`/`TromboneNote` (Task 1), `STAFF`, `STAFF_LINE_YS`, `noteY`, `ledgerYs` (Task 2)
- Produces: auto-imported components `<TromboneStaff :note="TromboneNote" />` and `<TromboneSlide :highlight="number | null" />` (Nuxt auto-import: directory prefix + filename)

- [ ] **Step 1: Write `app/components/Trombone/Staff.vue`**

```vue
<script setup lang="ts">
import type { TromboneNote } from '~/utils/trombone/positions'
import { STAFF, STAFF_LINE_YS, noteY, ledgerYs } from '~/utils/trombone/notation'

const props = defineProps<{ note: TromboneNote }>()

const y = computed(() => noteY(props.note))
const ledgers = computed(() => ledgerYs(props.note))
const accidental = computed(() =>
  props.note.accidental === 'flat' ? '♭' : props.note.accidental === 'sharp' ? '♯' : null,
)
</script>

<template>
  <svg :viewBox="STAFF.viewBox" class="w-full max-w-md mx-auto" role="img" aria-label="Note on a bass-clef staff">
    <!-- Staff lines -->
    <line
      v-for="ly in STAFF_LINE_YS"
      :key="`staff-${ly}`"
      :x1="STAFF.left"
      :x2="STAFF.right"
      :y1="ly"
      :y2="ly"
      class="stroke-ink-faint"
      stroke-width="1.5"
    />
    <!-- Bass clef: curl starting on the F line, plus the two dots -->
    <path
      d="M 34 68
         C 27 64 24 57 26 51
         C 28 45 35 42 43 42
         C 54 42 61 49 61 59
         C 61 78 45 95 26 106
         C 43 93 53 78 53 60
         C 53 51 49 46 43 46
         C 37 46 33 50 33 55
         C 34 53 37 51 40 51
         C 45 51 48 55 48 60
         C 48 65 44 69 39 69
         C 37 69 35 69 34 68
         Z"
      class="fill-ink"
    />
    <circle cx="72" cy="56" r="3.2" class="fill-ink" />
    <circle cx="72" cy="72" r="3.2" class="fill-ink" />
    <!-- Ledger lines -->
    <line
      v-for="ly in ledgers"
      :key="`ledger-${ly}`"
      :x1="STAFF.noteX - STAFF.ledgerHalfWidth"
      :x2="STAFF.noteX + STAFF.ledgerHalfWidth"
      :y1="ly"
      :y2="ly"
      class="stroke-ink-faint"
      stroke-width="1.5"
    />
    <!-- Accidental -->
    <text
      v-if="accidental"
      :x="STAFF.noteX - 26"
      :y="y + 7"
      class="fill-ink font-body"
      font-size="24"
    >{{ accidental }}</text>
    <!-- Notehead -->
    <ellipse
      :cx="STAFF.noteX"
      :cy="y"
      rx="7.5"
      ry="5.5"
      :transform="`rotate(-18 ${STAFF.noteX} ${y})`"
      class="fill-ink"
    />
  </svg>
</template>
```

- [ ] **Step 2: Write `app/components/Trombone/Slide.vue`**

```vue
<script setup lang="ts">
defineProps<{ highlight?: number | null }>()

const POSITIONS = [1, 2, 3, 4, 5, 6, 7]
const px = (p: number) => 30 + (p - 1) * 40
</script>

<template>
  <svg viewBox="0 0 300 70" class="w-full max-w-md mx-auto" role="img" aria-label="Trombone slide positions 1 to 7">
    <!-- Slide tube -->
    <rect x="10" y="33" width="280" height="4" rx="2" class="fill-ink-faint/60" />
    <g v-for="p in POSITIONS" :key="p">
      <circle
        :cx="px(p)"
        cy="35"
        r="12"
        stroke-width="1.5"
        :class="p === highlight ? 'fill-accent' : 'fill-surface-raised stroke-ink-faint'"
      />
      <text
        :x="px(p)"
        y="40"
        text-anchor="middle"
        font-size="13"
        class="font-display font-semibold"
        :class="p === highlight ? 'fill-surface' : 'fill-ink-muted'"
      >{{ p }}</text>
    </g>
  </svg>
</template>
```

- [ ] **Step 3: Write the static scaffold `app/pages/trombone.vue`**

Static demo content (B♭2 on the staff, 1st position highlighted) to prove the components render; Task 5 replaces the demo block with the quiz loop.

```vue
<script setup lang="ts">
import { NOTES } from '~/utils/trombone/positions'

useHead({ title: 'Trombone Trainer — Graeme Lawton' })

const demoNote = NOTES.find(n => n.id === 'Bb2')!
</script>

<template>
  <div>
    <!-- Header -->
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Practice
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Trombone Trainer
      </h1>
      <p class="font-body text-ink-muted mt-4 max-w-lg reveal reveal-d2">
        Learn concert-pitch bass clef on tenor trombone — name the note on the
        staff, or pick its slide position.
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <!-- Demo (replaced by quiz in Task 5) -->
    <div class="pt-8 pb-16 reveal reveal-d3">
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 max-w-xl mx-auto">
        <TromboneStaff :note="demoNote" />
        <TromboneSlide :highlight="demoNote.position" class="mt-6" />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Verify against the dev server**

```bash
cd /home/graemel/workspace/alola && npm run dev &
sleep 15
curl -s http://localhost:3000/trombone -o /tmp/trombone.html
grep -c '<ellipse' /tmp/trombone.html      # expected: 1 (the notehead)
grep -c 'viewBox="0 0 300 70"' /tmp/trombone.html  # expected: 1 (the slide)
grep -c 'Trombone Trainer' /tmp/trombone.html      # expected: >= 1
kill %1
```

Expected: counts as noted, no Vue/Nuxt errors in the dev-server output. Then (human check) open `http://localhost:3000/trombone` in a browser: the staff shows five lines, a recognisable bass clef with two dots straddling the second-from-top line, a ♭ accidental left of a notehead sitting on that same line (B♭2), and the slide diagram highlights position 1 in orange. **If the clef path looks malformed, tweak the path's control points until it reads as an F clef — this is the one hand-authored asset and is expected to need visual adjustment.**

- [ ] **Step 5: Commit**

```bash
git add app/components/Trombone app/pages/trombone.vue
git commit -m "feat(trombone): staff and slide SVG components with page scaffold"
```

---

### Task 5: Quiz loop UI

**Files:**
- Modify: `app/pages/trombone.vue` (replace the demo block with the quiz)

**Interfaces:**
- Consumes: `createQuiz`, `Question` (Task 3); `<TromboneStaff>`, `<TromboneSlide>` (Task 4)
- Produces: the finished feature — no downstream consumers

- [ ] **Step 1: Replace `app/pages/trombone.vue` with the full quiz page**

```vue
<script setup lang="ts">
import { createQuiz, type Question } from '~/utils/trombone/quiz'

useHead({ title: 'Trombone Trainer — Graeme Lawton' })

const quiz = createQuiz()
const question = ref<Question>(quiz.next())
const selected = ref<string | null>(null)
const isCorrect = ref(false)
const correct = ref(0)
const total = ref(0)
const streak = ref(0)

const prompt = computed(() =>
  question.value.mode === 'name' ? 'Name this note' : 'Which slide position?',
)

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th']
const answerText = computed(() => {
  const n = question.value.note
  return `${n.display} — ${ORDINALS[n.position]} position`
})

function answer(choice: string) {
  if (selected.value !== null) return
  selected.value = choice
  isCorrect.value = quiz.submit(question.value, choice)
  total.value++
  if (isCorrect.value) {
    correct.value++
    streak.value++
  } else {
    streak.value = 0
  }
}

function nextQuestion() {
  selected.value = null
  question.value = quiz.next()
}

function buttonClass(choice: string) {
  if (selected.value === null)
    return 'text-ink-muted hover:text-ink border border-ink-faint/20 hover:border-accent/50 cursor-pointer'
  if (choice === question.value.answer) return 'bg-accent text-surface'
  if (choice === selected.value) return 'text-red-400 border border-red-400/40'
  return 'text-ink-faint border border-ink-faint/10'
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Practice
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Trombone Trainer
      </h1>
      <p class="font-body text-ink-muted mt-4 max-w-lg reveal reveal-d2">
        Learn concert-pitch bass clef on tenor trombone — name the note on the
        staff, or pick its slide position.
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <!-- Score row -->
    <div class="flex gap-6 pt-8 pb-6 font-display text-xs font-semibold uppercase tracking-[0.2em] reveal reveal-d3">
      <span class="text-ink-muted">Score <span class="text-ink">{{ correct }}/{{ total }}</span></span>
      <span class="text-ink-muted">Streak <span class="text-accent">{{ streak }}</span></span>
    </div>

    <!-- Quiz card -->
    <div class="pb-16 reveal reveal-d4">
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 max-w-xl mx-auto">
        <TromboneStaff :note="question.note" />

        <p class="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted text-center mt-6 mb-4">
          {{ prompt }}
        </p>

        <!-- Answer buttons -->
        <div
          class="grid gap-2"
          :class="question.mode === 'name' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-4 sm:grid-cols-7'"
        >
          <button
            v-for="choice in question.choices"
            :key="choice"
            class="font-display text-sm font-semibold px-3 py-3 rounded-md transition-colors touch-manipulation"
            :class="buttonClass(choice)"
            @click="answer(choice)"
          >
            {{ choice }}
          </button>
        </div>

        <!-- Feedback -->
        <div v-if="selected !== null" class="mt-6 text-center">
          <p class="font-display font-semibold" :class="isCorrect ? 'text-accent' : 'text-red-400'">
            {{ isCorrect ? 'Correct!' : 'Not quite' }}
          </p>
          <p class="font-body text-ink-muted mt-1">{{ answerText }}</p>
          <TromboneSlide :highlight="question.note.position" class="mt-4" />
          <button
            class="font-display text-xs font-semibold uppercase tracking-[0.2em] px-6 py-3 mt-4 rounded-md bg-accent text-surface hover:bg-accent-light transition-colors touch-manipulation"
            @click="nextQuestion"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify against the dev server**

```bash
cd /home/graemel/workspace/alola && npm run dev &
sleep 15
curl -s http://localhost:3000/trombone -o /tmp/trombone.html
grep -c 'Name this note\|Which slide position?' /tmp/trombone.html  # expected: 1
grep -c 'Score' /tmp/trombone.html                                  # expected: >= 1
kill %1
```

Expected: one of the two prompts renders server-side, no dev-server errors. Then (human check) in the browser, run through at least 6 questions covering both modes and confirm:
1. Each question shows a note on the staff; ledger-line notes (E2, C4 and above) render ledger lines.
2. Name mode shows 4 note-name buttons; position mode shows buttons 1–7.
3. Answering highlights the correct button in orange, a wrong pick in red, shows "Correct!"/"Not quite" plus "<note> — <n>th position", and the slide diagram highlights the right position.
4. Score and streak update; a wrong answer resets streak to 0.
5. Next advances to a new question with buttons re-enabled.
6. On a phone-width viewport (~375px) the buttons remain tappable and nothing overflows.

- [ ] **Step 3: Run the full verification script one last time**

Run: `cd /home/graemel/workspace/alola && npx tsx scripts/verify-trombone.ts`
Expected: `verify-trombone: all checks passed`.

- [ ] **Step 4: Commit**

```bash
git add app/pages/trombone.vue
git commit -m "feat(trombone): quiz loop with score, streak and slide feedback"
```
