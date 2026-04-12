# Scrabble Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side Scrabble move analyzer at `/scrabble-solver` that parses Scopely Scrabble screenshots and finds the top 10 best moves.

**Architecture:** Canvas-based template matching extracts board state from screenshots. A Trie-backed solver running in a Web Worker generates and scores all valid moves. Vue page component handles upload, board display, correction, and results.

**Tech Stack:** Nuxt 4 (Vue 3), TypeScript, Canvas API, Web Workers, Tailwind CSS

**Note:** This project has no test framework configured. Verification is manual — run `npm run dev` and test in the browser.

---

## File Structure

```
app/
  pages/
    scrabble-solver.vue          # Main page — upload, board grid, results list
  utils/
    scrabble/
      board.ts                   # Board types, bonus square map, letter values, scoring
      trie.ts                    # Trie data structure for dictionary lookup
      solver.ts                  # Move generation and scoring algorithm
      solver.worker.ts           # Web Worker entry point
      parser.ts                  # Screenshot parsing — board detection, cell/rack extraction
      tiles.ts                   # Reference tile pixel data for Scopely letter matching
public/
  scrabble/
    dictionary.json              # TWL word list as JSON array
```

---

### Task 1: Board Types & Constants

**Files:**
- Create: `app/utils/scrabble/board.ts`

This file defines all Scrabble board constants and types. Everything else depends on it.

- [ ] **Step 1: Create board types and constants**

Create `app/utils/scrabble/board.ts` with the following:

```typescript
// Cell state
export type CellState = {
  letter: string | null   // A-Z or null for empty
  isBlank: boolean        // true if this tile is a blank (wildcard)
}

// Bonus square types
export type BonusType = 'DL' | 'TL' | 'DW' | 'TW' | null

// Board is a 15x15 grid
export const BOARD_SIZE = 15

// A complete board state
export type BoardState = {
  cells: CellState[][]    // 15x15
  rack: string[]          // up to 7 letters in hand
}

// Move result from solver
export type Move = {
  word: string
  row: number
  col: number
  direction: 'across' | 'down'
  score: number
  tilesUsed: string[]     // letters from rack used
  positions: { row: number; col: number; letter: string }[]  // where new tiles go
}

// Standard Scrabble letter values
export const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
}

// Bonus square map — BONUS_MAP[row][col] gives the bonus type
// Standard Scrabble board layout (symmetric)
const TW = 'TW' as const
const DW = 'DW' as const
const TL = 'TL' as const
const DL = 'DL' as const
const __ = null

export const BONUS_MAP: BonusType[][] = [
  [TW, __, __, DL, __, __, __, TW, __, __, __, DL, __, __, TW],
  [__, DW, __, __, __, TL, __, __, __, TL, __, __, __, DW, __],
  [__, __, DW, __, __, __, DL, __, DL, __, __, __, DW, __, __],
  [DL, __, __, DW, __, __, __, DL, __, __, __, DW, __, __, DL],
  [__, __, __, __, DW, __, __, __, __, __, DW, __, __, __, __],
  [__, TL, __, __, __, TL, __, __, __, TL, __, __, __, TL, __],
  [__, __, DL, __, __, __, DL, __, DL, __, __, __, DL, __, __],
  [TW, __, __, DL, __, __, __, DW, __, __, __, DL, __, __, TW],
  [__, __, DL, __, __, __, DL, __, DL, __, __, __, DL, __, __],
  [__, TL, __, __, __, TL, __, __, __, TL, __, __, __, TL, __],
  [__, __, __, __, DW, __, __, __, __, __, DW, __, __, __, __],
  [DL, __, __, DW, __, __, __, DL, __, __, __, DW, __, __, DL],
  [__, __, DW, __, __, __, DL, __, DL, __, __, __, DW, __, __],
  [__, DW, __, __, __, TL, __, __, __, TL, __, __, __, DW, __],
  [TW, __, __, DL, __, __, __, TW, __, __, __, DL, __, __, TW],
]

// Bonus square display colors (for UI)
export const BONUS_COLORS: Record<string, { bg: string; text: string }> = {
  TW: { bg: '#b91c1c', text: '#fecaca' },  // red
  DW: { bg: '#c2410c', text: '#fed7aa' },  // orange-red
  TL: { bg: '#1d4ed8', text: '#bfdbfe' },  // blue
  DL: { bg: '#0891b2', text: '#a5f3fc' },  // cyan
}

// Create an empty board state
export function createEmptyBoard(): BoardState {
  const cells: CellState[][] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: CellState[] = []
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push({ letter: null, isBlank: false })
    }
    cells.push(row)
  }
  return { cells, rack: [] }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/graemel/workspace/alola && npx nuxi typecheck 2>&1 | head -20`

If there are TypeScript errors, fix them. If `nuxi typecheck` isn't available, just run `npm run dev` and check for build errors in the terminal.

- [ ] **Step 3: Commit**

```bash
git add app/utils/scrabble/board.ts
git commit -m "feat(scrabble): add board types, constants, and bonus square map"
```

---

### Task 2: Trie Data Structure

**Files:**
- Create: `app/utils/scrabble/trie.ts`

The Trie is the dictionary lookup structure. It supports insertion and prefix/word lookup. The solver will walk the Trie while generating moves.

- [ ] **Step 1: Create the Trie**

Create `app/utils/scrabble/trie.ts`:

```typescript
export interface TrieNode {
  children: Record<string, TrieNode>
  isEnd: boolean
}

export function createNode(): TrieNode {
  return { children: {}, isEnd: false }
}

export function insert(root: TrieNode, word: string): void {
  let node = root
  for (const ch of word) {
    if (!node.children[ch]) {
      node.children[ch] = createNode()
    }
    node = node.children[ch]
  }
  node.isEnd = true
}

// Check if a complete word exists
export function isWord(root: TrieNode, word: string): boolean {
  let node = root
  for (const ch of word) {
    if (!node.children[ch]) return false
    node = node.children[ch]
  }
  return node.isEnd
}

// Check if any word starts with this prefix
export function hasPrefix(root: TrieNode, prefix: string): boolean {
  let node = root
  for (const ch of prefix) {
    if (!node.children[ch]) return false
    node = node.children[ch]
  }
  return true
}

// Build a Trie from a list of words
export function buildTrie(words: string[]): TrieNode {
  const root = createNode()
  for (const word of words) {
    insert(root, word.toUpperCase())
  }
  return root
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/scrabble/trie.ts
git commit -m "feat(scrabble): add Trie data structure for dictionary lookup"
```

---

### Task 3: Dictionary File

**Files:**
- Create: `public/scrabble/dictionary.json`

We need the TWL06 word list as a JSON array. This is a large file (~2MB) containing all valid Scrabble words.

- [ ] **Step 1: Source and create the dictionary file**

Download or source the TWL06 word list. Convert it to a JSON array of uppercase strings and save to `public/scrabble/dictionary.json`:

```json
["AA","AAH","AAHED","AAHING","AAHS","AAL","AALII","AALIIS","AALS","AARDVARK",...]
```

The file should contain all valid TWL06 words (approximately 178,691 words). If a direct TWL06 source is unavailable, use the Collins Scrabble Words (CSW) list or any freely available Scrabble dictionary.

Verify the file is valid JSON and contains a reasonable number of words:

Run: `node -e "const d = require('./public/scrabble/dictionary.json'); console.log('Words:', d.length)"`

Expected: a count in the range of 170,000–280,000 words.

- [ ] **Step 2: Commit**

```bash
git add public/scrabble/dictionary.json
git commit -m "feat(scrabble): add TWL word list dictionary"
```

---

### Task 4: Scrabble Solver Engine

**Files:**
- Create: `app/utils/scrabble/solver.ts`

This is the core algorithm. It finds all valid moves given a board state and rack, scores them, and returns the top 10. Uses the anchor-based approach from Andrew Appel and Guy Jacobson's paper on the world's fastest Scrabble program.

- [ ] **Step 1: Create the solver**

Create `app/utils/scrabble/solver.ts`:

```typescript
import {
  type BoardState,
  type Move,
  type BonusType,
  BOARD_SIZE,
  LETTER_VALUES,
  BONUS_MAP,
} from './board'
import { type TrieNode, isWord } from './trie'

// Score a single tile placement
function letterScore(letter: string, isBlank: boolean): number {
  if (isBlank) return 0
  return LETTER_VALUES[letter] || 0
}

// Score a complete move
function scoreMove(
  board: BoardState,
  positions: { row: number; col: number; letter: string; isBlank: boolean }[],
  direction: 'across' | 'down',
  trie: TrieNode,
): number | null {
  // Collect the full main word
  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0

  // Find the start of the main word
  let sr = positions[0].row
  let sc = positions[0].col
  while (sr - dr >= 0 && sc - dc >= 0) {
    const pr = sr - dr
    const pc = sc - dc
    if (board.cells[pr][pc].letter === null) break
    sr = pr
    sc = pc
  }

  // Walk forward to build the main word and compute its score
  let mainScore = 0
  let wordMultiplier = 1
  let mainWord = ''
  let r = sr
  let c = sc
  const newPositions = new Set(positions.map(p => `${p.row},${p.col}`))

  while (r < BOARD_SIZE && c < BOARD_SIZE) {
    const existing = board.cells[r][c].letter
    const placed = positions.find(p => p.row === r && p.col === c)

    if (!existing && !placed) break

    if (placed) {
      const bonus: BonusType = BONUS_MAP[r][c]
      let ls = letterScore(placed.letter, placed.isBlank)
      if (bonus === 'DL') ls *= 2
      if (bonus === 'TL') ls *= 3
      if (bonus === 'DW') wordMultiplier *= 2
      if (bonus === 'TW') wordMultiplier *= 3
      mainScore += ls
      mainWord += placed.letter
    } else {
      mainScore += letterScore(existing!, board.cells[r][c].isBlank)
      mainWord += existing!
    }

    r += dr
    c += dc
  }

  mainScore *= wordMultiplier

  // Main word must be at least 2 letters
  if (mainWord.length < 2) {
    // Unless it's the very first move and only one tile — but standard Scrabble requires 2+
    // We'll handle single-tile cross-words below
    if (positions.length === 1 && mainWord.length === 1) {
      // Single tile placed — main "word" is 1 char, but cross-words might be valid
      mainScore = 0
      mainWord = ''
    } else {
      return null
    }
  }

  // Validate main word
  if (mainWord.length >= 2 && !isWord(trie, mainWord)) return null

  // Check and score cross-words
  let crossScore = 0
  const crossDr = direction === 'across' ? 1 : 0
  const crossDc = direction === 'down' ? 1 : 0

  for (const pos of positions) {
    // Find start of cross-word
    let cr = pos.row
    let cc = pos.col
    while (cr - crossDr >= 0 && cc - crossDc >= 0) {
      const pr = cr - crossDr
      const pc = cc - crossDc
      if (board.cells[pr][pc].letter === null && !positions.find(p => p.row === pr && p.col === pc)) break
      cr = pr
      cc = pc
    }

    // Build cross-word
    let cWord = ''
    let cScore = 0
    let cMultiplier = 1
    let tr = cr
    let tc = cc
    while (tr < BOARD_SIZE && tc < BOARD_SIZE) {
      const existing = board.cells[tr][tc].letter
      const isNew = tr === pos.row && tc === pos.col

      if (!existing && !isNew) break

      if (isNew) {
        const bonus: BonusType = BONUS_MAP[tr][tc]
        let ls = letterScore(pos.letter, pos.isBlank)
        if (bonus === 'DL') ls *= 2
        if (bonus === 'TL') ls *= 3
        if (bonus === 'DW') cMultiplier *= 2
        if (bonus === 'TW') cMultiplier *= 3
        cScore += ls
        cWord += pos.letter
      } else {
        cScore += letterScore(existing!, board.cells[tr][tc].isBlank)
        cWord += existing!
      }

      tr += crossDr
      tc += crossDc
    }

    // If cross-word is just 1 letter, no cross-word formed — skip
    if (cWord.length <= 1) continue

    // Validate cross-word
    if (!isWord(trie, cWord)) return null

    cScore *= cMultiplier
    crossScore += cScore
  }

  let totalScore = mainScore + crossScore

  // 50-point bingo bonus for using all 7 tiles
  if (positions.length === 7) totalScore += 50

  // Must form at least one word
  if (mainWord.length < 2 && crossScore === 0) return null

  return totalScore
}

// Find all anchors — empty squares adjacent to existing tiles
function findAnchors(board: BoardState): { row: number; col: number }[] {
  const anchors: { row: number; col: number }[] = []
  const hasAnyTile = board.cells.some(row => row.some(cell => cell.letter !== null))

  if (!hasAnyTile) {
    // Empty board — center square is the only anchor
    return [{ row: 7, col: 7 }]
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board.cells[r][c].letter !== null) continue
      // Check adjacency
      const adjacent =
        (r > 0 && board.cells[r - 1][c].letter !== null) ||
        (r < 14 && board.cells[r + 1][c].letter !== null) ||
        (c > 0 && board.cells[r][c - 1].letter !== null) ||
        (c < 14 && board.cells[r][c + 1].letter !== null)
      if (adjacent) anchors.push({ row: r, col: c })
    }
  }

  return anchors
}

// Generate all valid moves
export function generateMoves(board: BoardState, trie: TrieNode): Move[] {
  const moves: Move[] = []
  const anchors = findAnchors(board)
  const rackLetters = [...board.rack]

  for (const anchor of anchors) {
    for (const direction of ['across', 'down'] as const) {
      generateMovesFromAnchor(board, trie, anchor, direction, rackLetters, moves)
    }
  }

  // Deduplicate moves (same word, same position, same direction)
  const seen = new Set<string>()
  const unique: Move[] = []
  for (const move of moves) {
    const key = `${move.word}-${move.row}-${move.col}-${move.direction}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(move)
    }
  }

  // Sort by score descending, return top 10
  unique.sort((a, b) => b.score - a.score)
  return unique.slice(0, 10)
}

function generateMovesFromAnchor(
  board: BoardState,
  trie: TrieNode,
  anchor: { row: number; col: number },
  direction: 'across' | 'down',
  rackLetters: string[],
  moves: Move[],
): void {
  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0

  // Determine how far back we can extend before the anchor
  let maxPrefix = 0
  let r = anchor.row - dr
  let c = anchor.col - dc
  while (r >= 0 && c >= 0 && board.cells[r][c].letter === null) {
    maxPrefix++
    r -= dr
    c -= dc
  }
  // Also check if there's an existing tile directly behind — if so, we can't place prefix tiles
  // because the existing tile is already part of a word
  r = anchor.row - dr
  c = anchor.col - dc
  if (r >= 0 && c >= 0 && board.cells[r][c].letter !== null) {
    maxPrefix = 0
  }

  // Try all prefix lengths from 0 to maxPrefix
  for (let prefixLen = 0; prefixLen <= maxPrefix; prefixLen++) {
    const startRow = anchor.row - dr * prefixLen
    const startCol = anchor.col - dc * prefixLen

    // Try placing tiles starting from startRow, startCol
    tryPlace(board, trie, startRow, startCol, direction, rackLetters, [], trie, moves)
  }
}

function tryPlace(
  board: BoardState,
  trie: TrieNode,
  row: number,
  col: number,
  direction: 'across' | 'down',
  available: string[],
  placed: { row: number; col: number; letter: string; isBlank: boolean }[],
  node: TrieNode,
  moves: Move[],
): void {
  if (row >= BOARD_SIZE || col >= BOARD_SIZE) {
    // End of board — check if we've formed a valid word
    if (node.isEnd && placed.length > 0) {
      const score = scoreMove(board, placed, direction, trie)
      if (score !== null) {
        const startPos = placed[0]
        // Find actual word start (may include existing tiles before our first placement)
        const dr = direction === 'down' ? 1 : 0
        const dc = direction === 'across' ? 1 : 0
        let sr = startPos.row
        let sc = startPos.col
        while (sr - dr >= 0 && sc - dc >= 0 && board.cells[sr - dr][sc - dc].letter !== null) {
          sr -= dr
          sc -= dc
        }
        // Build full word
        let word = ''
        let wr = sr
        let wc = sc
        while (wr < BOARD_SIZE && wc < BOARD_SIZE) {
          const existing = board.cells[wr][wc].letter
          const p = placed.find(pp => pp.row === wr && pp.col === wc)
          if (!existing && !p) break
          word += p ? p.letter : existing
          wr += dr
          wc += dc
        }

        moves.push({
          word,
          row: sr,
          col: sc,
          direction,
          score,
          tilesUsed: placed.map(p => p.letter),
          positions: placed.map(p => ({ row: p.row, col: p.col, letter: p.letter })),
        })
      }
    }
    return
  }

  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0
  const existing = board.cells[row][col].letter

  if (existing) {
    // Cell has an existing tile — must continue through it
    const upper = existing.toUpperCase()
    if (node.children[upper]) {
      tryPlace(board, trie, row + dr, col + dc, direction, available, placed, node.children[upper], moves)
    }
  } else {
    // Empty cell — try each available rack letter
    const tried = new Set<string>()
    for (let i = 0; i < available.length; i++) {
      const letter = available[i]

      if (letter === '?') {
        // Blank tile — try all 26 letters
        for (let ch = 65; ch <= 90; ch++) {
          const c = String.fromCharCode(ch)
          if (!node.children[c]) continue
          const newAvailable = [...available]
          newAvailable.splice(i, 1)
          const newPlaced = [...placed, { row, col, letter: c, isBlank: true }]
          tryPlace(board, trie, row + dr, col + dc, direction, newAvailable, newPlaced, node.children[c], moves)
        }
        break // Only process blank once
      } else {
        const upper = letter.toUpperCase()
        if (tried.has(upper)) continue
        tried.add(upper)
        if (!node.children[upper]) continue

        const newAvailable = [...available]
        newAvailable.splice(i, 1)
        const newPlaced = [...placed, { row, col, letter: upper, isBlank: false }]
        tryPlace(board, trie, row + dr, col + dc, direction, newAvailable, newPlaced, node.children[upper], moves)
      }
    }

    // Also try stopping here (if we've placed at least one tile)
    if (node.isEnd && placed.length > 0) {
      const score = scoreMove(board, placed, direction, trie)
      if (score !== null) {
        const dr2 = direction === 'down' ? 1 : 0
        const dc2 = direction === 'across' ? 1 : 0
        let sr = placed[0].row
        let sc = placed[0].col
        while (sr - dr2 >= 0 && sc - dc2 >= 0 && board.cells[sr - dr2][sc - dc2].letter !== null) {
          sr -= dr2
          sc -= dc2
        }
        let word = ''
        let wr = sr
        let wc = sc
        while (wr < BOARD_SIZE && wc < BOARD_SIZE) {
          const ex = board.cells[wr][wc].letter
          const p = placed.find(pp => pp.row === wr && pp.col === wc)
          if (!ex && !p) break
          word += p ? p.letter : ex
          wr += dr2
          wc += dc2
        }

        moves.push({
          word,
          row: sr,
          col: sc,
          direction,
          score,
          tilesUsed: placed.map(p => p.letter),
          positions: placed.map(p => ({ row: p.row, col: p.col, letter: p.letter })),
        })
      }
    }
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/graemel/workspace/alola && npx nuxi typecheck 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/utils/scrabble/solver.ts
git commit -m "feat(scrabble): add move generation and scoring solver engine"
```

---

### Task 5: Web Worker

**Files:**
- Create: `app/utils/scrabble/solver.worker.ts`

The solver runs in a Web Worker so the UI stays responsive. The worker loads the dictionary, builds the Trie, and processes solve requests.

- [ ] **Step 1: Create the worker**

Create `app/utils/scrabble/solver.worker.ts`:

```typescript
import { type BoardState } from './board'
import { buildTrie, type TrieNode } from './trie'
import { generateMoves } from './solver'

let trie: TrieNode | null = null

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  if (type === 'init') {
    // Load dictionary and build trie
    try {
      const response = await fetch('/scrabble/dictionary.json')
      const words: string[] = await response.json()
      trie = buildTrie(words)
      self.postMessage({ type: 'ready' })
    } catch (err) {
      self.postMessage({ type: 'error', payload: 'Failed to load dictionary' })
    }
  }

  if (type === 'solve') {
    if (!trie) {
      self.postMessage({ type: 'error', payload: 'Dictionary not loaded' })
      return
    }

    const board: BoardState = payload
    const startTime = performance.now()
    const moves = generateMoves(board, trie)
    const elapsed = Math.round(performance.now() - startTime)

    self.postMessage({ type: 'result', payload: { moves, elapsed } })
  }
}
```

- [ ] **Step 2: Check Nuxt Web Worker support**

Nuxt 4 with Vite supports Web Workers via `new Worker(new URL(...), { type: 'module' })`. Verify this pattern works by checking the Vite docs or existing examples. If Nuxt requires special configuration for workers (e.g. a `nuxt.config.ts` change), apply it now.

- [ ] **Step 3: Commit**

```bash
git add app/utils/scrabble/solver.worker.ts
git commit -m "feat(scrabble): add Web Worker for background solving"
```

---

### Task 6: Screenshot Parser — Tile Reference Data

**Files:**
- Create: `app/utils/scrabble/tiles.ts`

This file contains the reference pixel data for matching Scopely Scrabble tiles. During development, this needs to be built by capturing screenshots from the Scopely app and extracting tile image data.

- [ ] **Step 1: Create the tile reference module**

Create `app/utils/scrabble/tiles.ts` with a placeholder structure. The actual pixel data will be populated by analyzing Scopely screenshots.

```typescript
// Reference tile data for Scopely Scrabble app
// Each tile is represented as a grayscale pixel grid
// These values will be populated from actual Scopely screenshots

export interface TileReference {
  letter: string
  // Grayscale pixel values normalized to 0-255
  // Cropped to just the letter portion of the tile
  pixels: number[]
  width: number
  height: number
}

// Scopely tile background color (tan/cream) — for detecting tile vs empty
export const TILE_COLOR = { r: 230, g: 206, b: 168 }
export const TILE_COLOR_TOLERANCE = 40

// Board square colors for empty cell detection
export const BOARD_COLORS = {
  normal: { r: 205, g: 186, b: 150 },  // beige
  DL: { r: 120, g: 180, b: 200 },       // light blue
  TL: { r: 40, g: 90, b: 180 },         // dark blue
  DW: { r: 200, g: 120, b: 120 },       // pink
  TW: { r: 180, g: 50, b: 50 },         // red
}
export const BOARD_COLOR_TOLERANCE = 45

// Reference tiles — populated from Scopely screenshots during development
// For now, we'll use a simpler approach: compare extracted grayscale cell images
// against stored reference images using pixel difference scoring
export const REFERENCE_TILES: TileReference[] = []

// Color distance helper
export function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

// Check if a pixel color matches a target within tolerance
export function colorMatches(
  r: number, g: number, b: number,
  target: { r: number; g: number; b: number },
  tolerance: number,
): boolean {
  return colorDistance(r, g, b, target.r, target.g, target.b) <= tolerance
}
```

**Note:** The actual reference tile data (pixel arrays for A-Z) must be built from real Scopely screenshots. This requires:
1. Taking screenshots of the Scopely app showing all 26 letters
2. Loading them into a canvas, detecting tile bounds, and cropping each letter
3. Extracting grayscale pixel data and storing in this module

This manual step should be done as part of the first development iteration. The parser (Task 7) is designed to work once this data is populated.

- [ ] **Step 2: Commit**

```bash
git add app/utils/scrabble/tiles.ts
git commit -m "feat(scrabble): add tile reference data module for Scopely matching"
```

---

### Task 7: Screenshot Parser

**Files:**
- Create: `app/utils/scrabble/parser.ts`

Parses a Scopely Scrabble screenshot into a `BoardState`. Uses canvas to detect the board region, divide into cells, and classify each cell.

- [ ] **Step 1: Create the parser**

Create `app/utils/scrabble/parser.ts`:

```typescript
import { type BoardState, type CellState, BOARD_SIZE, createEmptyBoard } from './board'
import {
  TILE_COLOR,
  TILE_COLOR_TOLERANCE,
  REFERENCE_TILES,
  colorMatches,
  type TileReference,
} from './tiles'

export interface ParseResult {
  board: BoardState
  confidence: number[][]  // 0-1 confidence for each cell
  error: string | null
}

// Load an image file into an HTMLImageElement
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

// Detect the board region in the screenshot
// The Scopely board is a square region — we look for its boundaries
function detectBoardBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
  // Strategy: scan for the board region by looking for a dense area of
  // board-colored pixels. The board is roughly centered and takes up
  // most of the width on a phone screenshot.

  // Sample horizontal lines to find the board's vertical extent
  const sampleStep = Math.floor(height / 100)
  let topY = -1
  let bottomY = -1

  for (let y = 0; y < height; y += sampleStep) {
    const lineData = ctx.getImageData(0, y, width, 1).data
    let boardPixels = 0
    for (let x = 0; x < width; x++) {
      const i = x * 4
      const r = lineData[i]
      const g = lineData[i + 1]
      const b = lineData[i + 2]
      // Check if pixel looks like a board color (any square type) or tile
      if (isBoardOrTileColor(r, g, b)) {
        boardPixels++
      }
    }
    const ratio = boardPixels / width
    if (ratio > 0.3) {
      if (topY === -1) topY = y
      bottomY = y
    }
  }

  if (topY === -1) return null

  // Board is square, so size = bottomY - topY
  const size = bottomY - topY
  // Center horizontally
  const x = Math.floor((width - size) / 2)

  return { x, y: topY, size }
}

function isBoardOrTileColor(r: number, g: number, b: number): boolean {
  // Tile color (tan)
  if (colorMatches(r, g, b, TILE_COLOR, TILE_COLOR_TOLERANCE)) return true
  // Board square colors — various browns, blues, pinks, reds
  // Broad check: most board colors have moderate saturation
  const brightness = (r + g + b) / 3
  if (brightness > 40 && brightness < 230) return true
  return false
}

// Extract a single cell's pixel data and classify it
function classifyCell(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellSize: number,
): { letter: string | null; confidence: number } {
  // Sample the center region of the cell (avoid borders)
  const margin = Math.floor(cellSize * 0.15)
  const innerX = cellX + margin
  const innerY = cellY + margin
  const innerSize = cellSize - 2 * margin

  if (innerSize <= 0) return { letter: null, confidence: 1 }

  const imageData = ctx.getImageData(innerX, innerY, innerSize, innerSize)
  const data = imageData.data

  // Check if cell has a tile by looking for tile-colored pixels
  let tilePixels = 0
  const totalPixels = innerSize * innerSize
  for (let i = 0; i < data.length; i += 4) {
    if (colorMatches(data[i], data[i + 1], data[i + 2], TILE_COLOR, TILE_COLOR_TOLERANCE)) {
      tilePixels++
    }
  }

  const tileRatio = tilePixels / totalPixels
  if (tileRatio < 0.2) {
    // No tile here — empty square
    return { letter: null, confidence: 1 }
  }

  // Cell has a tile — try to identify the letter
  if (REFERENCE_TILES.length === 0) {
    // No reference data yet — return unknown
    return { letter: '?', confidence: 0 }
  }

  // Convert to grayscale for comparison
  const grayscale: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    grayscale.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]))
  }

  // Resize to match reference tile dimensions
  const ref = REFERENCE_TILES[0]
  const resized = resizeGrayscale(grayscale, innerSize, innerSize, ref.width, ref.height)

  // Compare against all reference tiles
  let bestMatch: TileReference | null = null
  let bestScore = Infinity

  for (const tile of REFERENCE_TILES) {
    let diff = 0
    for (let i = 0; i < resized.length && i < tile.pixels.length; i++) {
      diff += Math.abs(resized[i] - tile.pixels[i])
    }
    const avgDiff = diff / resized.length
    if (avgDiff < bestScore) {
      bestScore = avgDiff
      bestMatch = tile
    }
  }

  if (!bestMatch) return { letter: '?', confidence: 0 }

  // Convert score to confidence (lower diff = higher confidence)
  const confidence = Math.max(0, Math.min(1, 1 - bestScore / 128))

  return { letter: bestMatch.letter, confidence }
}

// Simple nearest-neighbor resize for grayscale arrays
function resizeGrayscale(
  source: number[],
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): number[] {
  const result: number[] = new Array(dstW * dstH)
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.floor(x * srcW / dstW)
      const srcY = Math.floor(y * srcH / dstH)
      result[y * dstW + x] = source[srcY * srcW + srcX]
    }
  }
  return result
}

// Parse rack tiles from the screenshot
function parseRack(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  boardSize: number,
  canvasHeight: number,
): { letters: string[]; confidence: number[] } {
  // The rack is below the board in Scopely screenshots
  // Typically 7 tiles in a row, centered
  const rackY = boardY + boardSize + Math.floor(boardSize * 0.08)
  const rackHeight = Math.floor(boardSize / BOARD_SIZE * 1.2)
  const tileWidth = Math.floor(boardSize / BOARD_SIZE * 1.1)
  const rackWidth = tileWidth * 7
  const rackX = boardX + Math.floor((boardSize - rackWidth) / 2)

  const letters: string[] = []
  const confidence: number[] = []

  for (let i = 0; i < 7; i++) {
    const tileX = rackX + i * tileWidth
    if (tileX + tileWidth > ctx.canvas.width || rackY + rackHeight > canvasHeight) {
      break
    }
    const result = classifyCell(ctx, tileX, rackY, Math.min(tileWidth, rackHeight))
    if (result.letter) {
      letters.push(result.letter)
      confidence.push(result.confidence)
    }
  }

  return { letters, confidence }
}

// Main parse function
export async function parseScreenshot(file: File): Promise<ParseResult> {
  try {
    const img = await loadImage(file)

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    // Detect board bounds
    const bounds = detectBoardBounds(ctx, img.width, img.height)
    if (!bounds) {
      return {
        board: createEmptyBoard(),
        confidence: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
        error: 'Could not detect the Scrabble board in this image. Make sure it\'s a screenshot from the Scopely Scrabble app.',
      }
    }

    // Parse each cell
    const cellSize = bounds.size / BOARD_SIZE
    const board = createEmptyBoard()
    const confidence: number[][] = []

    for (let r = 0; r < BOARD_SIZE; r++) {
      const rowConfidence: number[] = []
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cellX = bounds.x + c * cellSize
        const cellY = bounds.y + r * cellSize
        const result = classifyCell(ctx, Math.floor(cellX), Math.floor(cellY), Math.floor(cellSize))
        board.cells[r][c] = { letter: result.letter, isBlank: false }
        rowConfidence.push(result.confidence)
      }
      confidence.push(rowConfidence)
    }

    // Parse rack
    const rack = parseRack(ctx, bounds.x, bounds.y, bounds.size, img.height)
    board.rack = rack.letters

    return { board, confidence, error: null }
  } catch (err) {
    return {
      board: createEmptyBoard(),
      confidence: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
      error: `Failed to parse screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/scrabble/parser.ts
git commit -m "feat(scrabble): add screenshot parser with board detection and cell classification"
```

---

### Task 8: Page Component — Upload & Board Display

**Files:**
- Create: `app/pages/scrabble-solver.vue`

Build the page in two tasks. This task covers the page shell, upload area, and board grid. Task 9 adds the solver integration and results list.

- [ ] **Step 1: Create the page component with upload and board**

Create `app/pages/scrabble-solver.vue`:

```vue
<template>
  <div>
    <!-- Header -->
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Tool
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Scrabble Solver
      </h1>
      <p class="font-body text-ink-muted mt-3 leading-relaxed max-w-lg reveal reveal-d2">
        Upload a screenshot from Scrabble (by Scopely) to find the best moves.
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <!-- Upload area -->
    <div
      v-if="!boardState"
      class="mt-8 reveal reveal-d3"
    >
      <div
        class="border-2 border-dashed border-ink-faint/30 rounded-lg p-12 text-center cursor-pointer hover:border-accent/50 transition-colors"
        :class="{ 'border-accent bg-accent/5': isDragging }"
        @click="fileInput?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <p class="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Drop screenshot here
        </p>
        <p class="font-body text-ink-faint text-sm mt-2">
          or click to upload — also supports Ctrl+V paste
        </p>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileSelect"
      >
    </div>

    <!-- Board display -->
    <div
      v-if="boardState"
      class="mt-8 reveal reveal-d3"
    >
      <!-- Board grid -->
      <div class="flex justify-center">
        <div class="w-full max-w-[min(100vw-2rem,480px)]">
          <div
            class="grid gap-[1px] bg-ink-faint/20 rounded"
            :style="{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }"
          >
            <button
              v-for="(_, idx) in BOARD_SIZE * BOARD_SIZE"
              :key="idx"
              class="aspect-square flex items-center justify-center text-[10px] sm:text-xs font-display font-bold relative"
              :class="cellClass(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
              @click="editCell(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
            >
              <!-- Editing input -->
              <input
                v-if="editingCell?.row === Math.floor(idx / BOARD_SIZE) && editingCell?.col === idx % BOARD_SIZE"
                ref="cellInputRef"
                type="text"
                maxlength="1"
                class="absolute inset-0 w-full h-full text-center bg-transparent text-ink font-display font-bold text-[10px] sm:text-xs uppercase outline-none border-2 border-accent rounded-sm"
                :value="boardState.cells[Math.floor(idx / BOARD_SIZE)][idx % BOARD_SIZE].letter || ''"
                @input="onCellInput($event, Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
                @blur="editingCell = null"
                @keydown.enter="editingCell = null"
                @keydown.escape="editingCell = null"
              >
              <!-- Cell content -->
              <template v-else>
                <span v-if="boardState.cells[Math.floor(idx / BOARD_SIZE)][idx % BOARD_SIZE].letter">
                  {{ boardState.cells[Math.floor(idx / BOARD_SIZE)][idx % BOARD_SIZE].letter }}
                </span>
                <span
                  v-else-if="getBonusLabel(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
                  class="text-[7px] sm:text-[9px] opacity-60"
                >
                  {{ getBonusLabel(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE) }}
                </span>
              </template>
              <!-- Highlighted move tile -->
              <div
                v-if="isHighlightedPosition(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
                class="absolute inset-0 flex items-center justify-center bg-accent/90 text-surface text-[10px] sm:text-xs font-display font-bold rounded-sm"
              >
                {{ getHighlightedLetter(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE) }}
              </div>
              <!-- Low confidence indicator -->
              <div
                v-if="isLowConfidence(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
                class="absolute inset-0 border-2 border-accent rounded-sm pointer-events-none"
              />
            </button>
          </div>

          <!-- Rack -->
          <div class="mt-4 flex justify-center gap-1">
            <div
              v-for="(letter, i) in paddedRack"
              :key="i"
              class="w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center font-display font-bold text-sm sm:text-base cursor-pointer"
              :class="letter ? 'bg-surface-subtle text-ink' : 'bg-surface-raised text-ink-faint border border-dashed border-ink-faint/30'"
              @click="editRackTile(i)"
            >
              {{ letter || '+' }}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-center gap-4 mt-4">
            <button
              v-if="hasChanges"
              class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent hover:text-accent-light transition-colors accent-hover"
              @click="solve"
            >
              Re-solve
            </button>
            <button
              class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint hover:text-ink transition-colors accent-hover"
              @click="reset"
            >
              New Screenshot
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <div v-if="parseError" class="mt-6 text-center">
      <p class="font-body text-red-400 text-sm">{{ parseError }}</p>
    </div>

    <!-- Results list -->
    <div
      v-if="moves.length > 0"
      class="mt-8 max-w-[480px] mx-auto reveal reveal-d4"
    >
      <h2 class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-4">
        Top Moves
      </h2>
      <div class="space-y-2">
        <button
          v-for="(move, i) in moves"
          :key="i"
          class="w-full text-left px-4 py-3 rounded-lg transition-colors"
          :class="selectedMove === i
            ? 'bg-accent/15 border border-accent/40'
            : 'bg-surface-raised border border-ink-faint/10 hover:border-ink-faint/30'"
          @click="selectedMove = i"
        >
          <div class="flex items-center justify-between">
            <div>
              <span class="font-display font-bold text-sm tracking-wide" :class="selectedMove === i ? 'text-accent' : 'text-ink'">
                {{ move.word }}
              </span>
              <span class="font-body text-ink-faint text-xs ml-2">
                Row {{ move.row + 1 }}, Col {{ move.col + 1 }} {{ move.direction === 'across' ? '→' : '↓' }}
              </span>
            </div>
            <span class="font-display font-extrabold text-lg" :class="selectedMove === i ? 'text-accent' : 'text-ink-muted'">
              {{ move.score }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Solving indicator -->
    <div v-if="isSolving" class="mt-8 text-center">
      <p class="font-display text-sm text-ink-muted animate-pulse">Solving...</p>
    </div>

    <!-- No moves found -->
    <div v-if="solveComplete && moves.length === 0 && !parseError" class="mt-8 text-center">
      <p class="font-body text-ink-muted text-sm">No valid moves found. Check the board and rack.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BOARD_SIZE,
  BONUS_MAP,
  BONUS_COLORS,
  createEmptyBoard,
  type BoardState,
  type Move,
} from '~/utils/scrabble/board'
import { parseScreenshot } from '~/utils/scrabble/parser'

useHead({
  title: 'Scrabble Solver',
  meta: [{ name: 'description', content: 'Upload a Scrabble screenshot and find the best moves.' }],
})

// State
const boardState = ref<BoardState | null>(null)
const confidence = ref<number[][]>([])
const parseError = ref<string | null>(null)
const moves = ref<Move[]>([])
const selectedMove = ref<number>(0)
const isSolving = ref(false)
const solveComplete = ref(false)
const hasChanges = ref(false)
const isDragging = ref(false)
const editingCell = ref<{ row: number; col: number } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cellInputRef = ref<HTMLInputElement[] | null>(null)

// Worker
let worker: Worker | null = null
let workerReady = false

onMounted(() => {
  // Init worker
  worker = new Worker(
    new URL('~/utils/scrabble/solver.worker.ts', import.meta.url),
    { type: 'module' },
  )
  worker.onmessage = (e) => {
    const { type, payload } = e.data
    if (type === 'ready') {
      workerReady = true
      // If board was parsed before worker was ready, solve now
      if (boardState.value && !solveComplete.value) {
        solve()
      }
    }
    if (type === 'result') {
      moves.value = payload.moves
      isSolving.value = false
      solveComplete.value = true
      selectedMove.value = 0
    }
    if (type === 'error') {
      parseError.value = payload
      isSolving.value = false
    }
  }
  worker.postMessage({ type: 'init' })

  // Clipboard paste support
  document.addEventListener('paste', handlePaste)
})

onBeforeUnmount(() => {
  worker?.terminate()
  document.removeEventListener('paste', handlePaste)
})

// Rack padded to 7 slots
const paddedRack = computed(() => {
  const rack = boardState.value?.rack || []
  const padded = [...rack]
  while (padded.length < 7) padded.push('')
  return padded
})

// Upload handlers
function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) processFile(input.files[0])
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) processFile(file)
      break
    }
  }
}

async function processFile(file: File) {
  parseError.value = null
  moves.value = []
  solveComplete.value = false
  hasChanges.value = false

  const result = await parseScreenshot(file)
  boardState.value = result.board
  confidence.value = result.confidence

  if (result.error) {
    parseError.value = result.error
    return
  }

  solve()
}

// Solver
function solve() {
  if (!boardState.value || !worker) return
  if (!workerReady) return // Will solve when worker is ready

  isSolving.value = true
  solveComplete.value = false
  hasChanges.value = false
  worker.postMessage({ type: 'solve', payload: toRaw(boardState.value) })
}

// Board interaction
function cellClass(row: number, col: number): string {
  const cell = boardState.value?.cells[row][col]
  if (cell?.letter) {
    return 'bg-surface-subtle text-ink'
  }
  const bonus = BONUS_MAP[row][col]
  if (bonus) {
    const colors = BONUS_COLORS[bonus]
    return `text-ink`
  }
  return 'bg-surface-raised text-ink-faint'
}

function getBonusLabel(row: number, col: number): string | null {
  if (boardState.value?.cells[row][col].letter) return null
  return BONUS_MAP[row][col]
}

function editCell(row: number, col: number) {
  editingCell.value = { row, col }
  nextTick(() => {
    cellInputRef.value?.[0]?.focus()
  })
}

function onCellInput(e: Event, row: number, col: number) {
  const input = e.target as HTMLInputElement
  const val = input.value.toUpperCase().replace(/[^A-Z]/g, '')
  if (boardState.value) {
    boardState.value.cells[row][col].letter = val || null
    hasChanges.value = true
  }
  editingCell.value = null
}

function editRackTile(index: number) {
  const letter = prompt('Enter rack letter (A-Z, or ? for blank):')
  if (letter === null) return
  const cleaned = letter.toUpperCase().trim()
  if (cleaned && !/^[A-Z?]$/.test(cleaned)) return
  if (boardState.value) {
    const rack = [...boardState.value.rack]
    if (cleaned) {
      rack[index] = cleaned
    } else {
      rack.splice(index, 1)
    }
    boardState.value.rack = rack
    hasChanges.value = true
  }
}

function isLowConfidence(row: number, col: number): boolean {
  if (!confidence.value[row]) return false
  return confidence.value[row][col] < 0.7 && boardState.value?.cells[row][col].letter !== null
}

function isHighlightedPosition(row: number, col: number): boolean {
  if (selectedMove.value < 0 || selectedMove.value >= moves.value.length) return false
  return moves.value[selectedMove.value].positions.some(p => p.row === row && p.col === col)
}

function getHighlightedLetter(row: number, col: number): string {
  if (selectedMove.value < 0 || selectedMove.value >= moves.value.length) return ''
  const pos = moves.value[selectedMove.value].positions.find(p => p.row === row && p.col === col)
  return pos?.letter || ''
}

function reset() {
  boardState.value = null
  confidence.value = []
  parseError.value = null
  moves.value = []
  selectedMove.value = 0
  solveComplete.value = false
  hasChanges.value = false
}
</script>

<style scoped>
/* Bonus square background colors — applied via inline styles would be cleaner
   but we use a simple approach with CSS custom properties */
</style>
```

- [ ] **Step 2: Apply bonus square colors inline**

The `cellClass` function needs to set bonus square background colors. Update it to use inline styles instead of classes. Replace the `cellClass` function and the cell button in the template.

In the template, change the cell button to:

```vue
<button
  v-for="(_, idx) in BOARD_SIZE * BOARD_SIZE"
  :key="idx"
  class="aspect-square flex items-center justify-center text-[10px] sm:text-xs font-display font-bold relative rounded-sm"
  :style="cellStyle(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
  @click="editCell(Math.floor(idx / BOARD_SIZE), idx % BOARD_SIZE)"
>
```

Add a `cellStyle` function in the script:

```typescript
function cellStyle(row: number, col: number): Record<string, string> {
  const cell = boardState.value?.cells[row][col]
  if (cell?.letter) {
    return { backgroundColor: '#28251f', color: '#e8e2d6' }
  }
  const bonus = BONUS_MAP[row][col]
  if (bonus) {
    const colors = BONUS_COLORS[bonus]
    return { backgroundColor: colors.bg, color: colors.text }
  }
  return { backgroundColor: '#1e1c18', color: '#5c5649' }
}
```

- [ ] **Step 3: Run dev server and verify the page loads**

Run: `cd /home/graemel/workspace/alola && npm run dev`

Open `http://localhost:3000/scrabble-solver` in the browser. Verify:
- The page header renders with "Scrabble Solver"
- The upload drop zone appears
- No console errors

- [ ] **Step 4: Commit**

```bash
git add app/pages/scrabble-solver.vue
git commit -m "feat(scrabble): add scrabble solver page with upload, board, and results"
```

---

### Task 9: Integration Testing & Polish

**Files:**
- Modify: `app/pages/scrabble-solver.vue`
- Modify: `app/utils/scrabble/solver.worker.ts` (if worker loading needs adjustment)

Manually test the full flow end-to-end and fix any issues.

- [ ] **Step 1: Test with manual board entry**

Since the parser needs real Scopely reference tile data to work, first test the solver by manually entering a board state. In the browser console on the scrabble-solver page, or by temporarily adding a "Demo" button:

Add a temporary demo function to the page script:

```typescript
function loadDemo() {
  const board = createEmptyBoard()
  // Place "HELLO" horizontally at row 7
  const word = 'HELLO'
  for (let i = 0; i < word.length; i++) {
    board.cells[7][5 + i] = { letter: word[i], isBlank: false }
  }
  board.rack = ['S', 'T', 'A', 'R', 'E', 'N', 'I']
  boardState.value = board
  confidence.value = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(1))
  solve()
}
```

Add a demo button in the upload area:

```vue
<button
  class="mt-4 font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint hover:text-accent transition-colors"
  @click="loadDemo"
>
  Load Demo Board
</button>
```

Verify:
- The board renders with "HELLO" placed
- The rack shows S, T, A, R, E, N, I
- After a moment, the solver returns moves
- Clicking a move highlights tiles on the board

- [ ] **Step 2: Fix any Web Worker loading issues**

If the worker fails to load (common in Nuxt), try alternative import patterns:

```typescript
// Option A: Vite worker import
worker = new Worker(
  new URL('../utils/scrabble/solver.worker.ts', import.meta.url),
  { type: 'module' },
)

// Option B: If Option A fails, inline the worker logic
// and use a blob URL approach
```

- [ ] **Step 3: Test cell editing**

- Click a cell on the board → input should appear
- Type a letter → cell updates
- "Re-solve" button should appear
- Click "Re-solve" → new results

- [ ] **Step 4: Test rack editing**

- Click a rack tile → prompt appears
- Enter a letter → rack updates
- Enter "?" → blank tile stored
- "Re-solve" button appears

- [ ] **Step 5: Remove demo button (optional)**

Once the parser has reference tile data and works, remove the demo button. Or keep it as a convenience feature — user's choice.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(scrabble): integration fixes and manual testing polish"
```

---

### Task 10: Add Navigation Link

**Files:**
- Modify: `app/components/Layout/Header.vue`
- Modify: `app/pages/projects.vue` (optional — add to projects list)

- [ ] **Step 1: Check the header for navigation links**

Read `app/components/Layout/Header.vue` to see how nav links are structured, then add a link to `/scrabble-solver`.

- [ ] **Step 2: Add the scrabble solver to the nav**

Follow the existing pattern for nav links in the header. Add "Scrabble" or "Scrabble Solver" as a nav item linking to `/scrabble-solver`.

- [ ] **Step 3: Verify navigation works**

Run the dev server, click the new nav link, confirm it navigates to the scrabble solver page with the page transition.

- [ ] **Step 4: Commit**

```bash
git add app/components/Layout/Header.vue
git commit -m "feat(scrabble): add scrabble solver to site navigation"
```
