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
