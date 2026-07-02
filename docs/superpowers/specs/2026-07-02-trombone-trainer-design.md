# Trombone Trainer — Design

**Date:** 2026-07-02
**Route:** `/trombone` (unlinked — direct URL only)
**Status:** Approved design, ready for implementation planning

## Purpose

Graeme plays tenor trombone in UK brass bands, where the instrument is taught as a
transposing B♭ instrument read in **treble clef**. He wants to learn to read
**concert-pitch bass clef**, which means relearning both the notes on the staff and
the slide position each note maps to. This is a practice tool to drill that new
mapping until it's automatic.

## Scope

- **In:** A quiz page that shows a single note on a bass-clef staff and asks the user
  to either name the note or give its slide position, with immediate feedback and a
  visual slide diagram.
- **Out:** Login/persistence across sessions, alternate slide positions, pedal/high
  extremes beyond the core range, audio playback, multi-instrument support.

## Delivery — integrate into the Nuxt site (`alola`)

Built as a native feature of the existing Nuxt 4 personal site, following the
established pattern used by `tic-tac-toe.vue` (labelled "Game") and
`scrabble-solver.vue` (labelled "Tool"):

- **Page:** `app/pages/trombone.vue`, labelled **"Practice"**, using the standard
  header shape (uppercase accent label → `<h1>` → `reveal` stagger animations →
  hairline rule).
- **Logic in `app/utils/trombone/`** (mirrors `app/utils/scrabble/`), keeping the
  page component thin:
  - `positions.ts` — the verified note→position chart and per-note metadata
    (letter, accidental, octave, canonical display spelling, primary slide position).
  - `quiz.ts` — question generation (random note + random mode) and the
    wrong-answer weighting.
  - `notation.ts` — pure geometry helpers mapping a note to its vertical position on
    the bass-clef staff (which line/space, ledger lines, accidental placement).
- **Components in `app/components/Trombone/`** (mirrors `Todo/`):
  - `Staff.vue` — renders the bass-clef staff and the current note as inline SVG.
  - `Slide.vue` — renders a stylised trombone slide with positions 1–7, highlighting
    a given position (used for feedback).
- **Styling:** existing Tailwind design tokens (`surface`, `ink`, `accent`),
  dark theme, `font-display` (Syne) / `font-body` (Lora), `<script setup>` + TS.

Note: the site's PWA service worker is scoped to `/todos/` only, so `/trombone`
requires a network connection. Offline support for the public site is out of scope;
widening the service-worker scope could be a follow-up if offline practice on a
music stand proves necessary.

## The quiz loop

Each question:

1. `quiz.ts` picks a note (weighted — see below) and a **mode** at random:
   - **Name it** — show the note on the staff; user taps the note name from ~4
     multiple-choice buttons.
   - **Position it** — show the note on the staff; user taps the slide position from
     buttons **1–7**.
2. User taps an answer → immediate right/wrong feedback → the correct answer is shown.
3. For **Position it** questions, `Slide.vue` highlights the correct slide position.
   For **Name it** questions, the correct note name is shown (and, as a bonus of the
   feedback panel, its position too so both halves reinforce each other).
4. A **"Next"** control advances to a new question.
5. A running **score** and **streak** are shown at the top of the page.

### Multiple-choice answer construction

- **Name it:** the correct button shows the note's canonical display spelling; the
  other 3 buttons are distinct other in-range notes (distractors), shuffled.
- **Position it:** buttons are the fixed set 1–7; the correct one is the note's
  primary position.

## Musical scope & data

- **Instrument:** tenor B♭ trombone, concert pitch, **bass clef**.
- **Range:** E2 (first ledger line below the staff, 7th position) up to F4 (top,
  above the staff) — the everyday band range. The chart is data-driven so the range
  can be widened later by adding rows.
- **Primary slide position only** per note (no alternates).

### Note → primary position chart (26 notes)

The mapping is derived from the trombone harmonic series (1st-position partials
B♭2, F3, B♭3, D4, F4, B♭4; each successive position lowers pitch one semitone) and
matches the standard tenor-trombone position chart. It will be encoded as verified
data in `positions.ts` and cross-checked during the build.

| Note | Pos | Note | Pos | Note | Pos |
|------|-----|------|-----|------|-----|
| E2   | 7   | E3   | 2   | C4   | 3   |
| F2   | 6   | F3   | 1   | C♯4  | 2   |
| F♯2  | 5   | F♯3  | 5   | D4   | 1   |
| G2   | 4   | G3   | 4   | E♭4  | 3   |
| A♭2  | 3   | A♭3  | 3   | E4   | 2   |
| A2   | 2   | A3   | 2   | F4   | 1   |
| B♭2  | 1   | B♭3  | 1   |      |     |
| B2   | 7   | B3   | 4   |      |     |
| C3   | 6   |      |     |      |     |
| C♯3  | 5   | D3   | 4   | E♭3  | 3   |

Canonical display spellings use the accidentals shown above (F♯ and B♭/A♭/E♭/C♯
families as listed). Enharmonic equivalents are not offered as separate answers.

### Staff placement reference (for `notation.ts`)

Bass-clef diatonic anchors (bottom → top): line1 = G2, line2 = B2, line3 = D3,
line4 = F3, line5 = A3. Spaces: A2, C3, E3, G3. Below the staff: F2 in the space
below line1, E2 on the first ledger line below. Above the staff: B3 in the space
above line5, C4 on the first ledger line above, D4/E4/F4 continue upward.
`notation.ts` computes each note's vertical offset from its letter + octave (diatonic
step count) and renders ledger lines for notes beyond the staff.

## Smart practice (lightweight, session-only)

- Each note carries an in-memory weight. A **wrong** answer increases that note's
  weight so it reappears more often; correct answers gradually decay it back toward
  baseline. This focuses drilling on weak spots without any accounts or persistence.
- No storage between sessions (YAGNI). Reloading the page resets weights, score,
  and streak.

## Testing

No test framework is configured in the repo (per `CLAUDE.md`), so the primary logic
(`positions.ts` correctness and `quiz.ts` answer construction) will be verified by
manual review against the chart above and by exercising the page in the browser. The
note→position data is the single source of truth and must match the table exactly.

## Component/data boundaries

- `positions.ts` — **what:** the authoritative note dataset; **use:** import the note
  list and per-note metadata; **depends on:** nothing.
- `notation.ts` — **what:** pure note→staff-geometry; **use:** given a note, get SVG
  coordinates + ledger info; **depends on:** the note metadata shape only.
- `quiz.ts` — **what:** question/answer generation + weighting; **use:** get next
  question, submit answer; **depends on:** `positions.ts`.
- `Staff.vue` — **what:** draw a note; **depends on:** `notation.ts`.
- `Slide.vue` — **what:** draw slide with a highlighted position; **depends on:** a
  position number only.
- `trombone.vue` — **what:** orchestrates the loop and score/streak UI; **depends on:**
  `quiz.ts`, `Staff.vue`, `Slide.vue`.
