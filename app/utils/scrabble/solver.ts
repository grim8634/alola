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
    } else {
      mainScore += letterScore(existing!, board.cells[r][c].isBlank)
    }
    mainWord += placed ? placed.letter : existing!

    r += dr
    c += dc
  }

  mainScore *= wordMultiplier

  if (mainWord.length < 2) {
    if (positions.length === 1 && mainWord.length === 1) {
      mainScore = 0
      mainWord = ''
    } else {
      return null
    }
  }

  if (mainWord.length >= 2 && !isWord(trie, mainWord)) return null

  // Check and score cross-words
  let crossScore = 0
  const crossDr = direction === 'across' ? 1 : 0
  const crossDc = direction === 'down' ? 1 : 0

  for (const pos of positions) {
    let cr = pos.row
    let cc = pos.col
    while (cr - crossDr >= 0 && cc - crossDc >= 0) {
      const pr = cr - crossDr
      const pc = cc - crossDc
      if (board.cells[pr][pc].letter === null && !positions.find(p => p.row === pr && p.col === pc)) break
      cr = pr
      cc = pc
    }

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

    if (cWord.length <= 1) continue
    if (!isWord(trie, cWord)) return null

    cScore *= cMultiplier
    crossScore += cScore
  }

  let totalScore = mainScore + crossScore
  if (positions.length === 7) totalScore += 50
  if (mainWord.length < 2 && crossScore === 0) return null

  return totalScore
}

// Find all anchors (empty squares adjacent to existing tiles, or center on empty board)
function findAnchors(board: BoardState): { row: number; col: number }[] {
  const anchors: { row: number; col: number }[] = []
  const hasAnyTile = board.cells.some(row => row.some(cell => cell.letter !== null))

  if (!hasAnyTile) {
    return [{ row: 7, col: 7 }]
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board.cells[r][c].letter !== null) continue
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

// Generate all valid moves, returning the top 10 by score
export function generateMoves(board: BoardState, trie: TrieNode): Move[] {
  const moves: Move[] = []
  const anchors = findAnchors(board)
  const rackLetters = [...board.rack]

  for (const anchor of anchors) {
    for (const direction of ['across', 'down'] as const) {
      generateMovesFromAnchor(board, trie, anchor, direction, rackLetters, moves)
    }
  }

  // Deduplicate moves by word + position + direction
  const seen = new Set<string>()
  const unique: Move[] = []
  for (const move of moves) {
    const key = `${move.word}-${move.row}-${move.col}-${move.direction}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(move)
    }
  }

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

  // Calculate how far back we can extend a prefix from the anchor
  let maxPrefix = 0
  let r = anchor.row - dr
  let c = anchor.col - dc
  while (r >= 0 && c >= 0 && board.cells[r][c].letter === null) {
    maxPrefix++
    r -= dr
    c -= dc
  }
  // If the square immediately before anchor has a tile, no prefix extension
  r = anchor.row - dr
  c = anchor.col - dc
  if (r >= 0 && c >= 0 && board.cells[r][c].letter !== null) {
    maxPrefix = 0
  }

  for (let prefixLen = 0; prefixLen <= maxPrefix; prefixLen++) {
    const startRow = anchor.row - dr * prefixLen
    const startCol = anchor.col - dc * prefixLen
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
    if (node.isEnd && placed.length > 0) {
      emitMove(board, trie, placed, direction, moves)
    }
    return
  }

  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0
  const existing = board.cells[row][col].letter

  if (existing) {
    // Square already has a tile — follow it in the trie
    const upper = existing.toUpperCase()
    if (node.children[upper]) {
      tryPlace(board, trie, row + dr, col + dc, direction, available, placed, node.children[upper], moves)
    }
  } else {
    // Empty square — try placing rack tiles
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

    // Also check if the current trie node is a word end (stop extending)
    if (node.isEnd && placed.length > 0) {
      emitMove(board, trie, placed, direction, moves)
    }
  }
}

// Check that placed tiles connect to at least one existing tile on the board
function isConnected(
  board: BoardState,
  placed: { row: number; col: number }[],
): boolean {
  const hasAnyTile = board.cells.some(row => row.some(cell => cell.letter !== null))
  if (!hasAnyTile) return true // Empty board — first move, always valid

  for (const { row, col } of placed) {
    // Check if this placed tile is adjacent to an existing tile
    if (row > 0 && board.cells[row - 1][col].letter !== null) return true
    if (row < 14 && board.cells[row + 1][col].letter !== null) return true
    if (col > 0 && board.cells[row][col - 1].letter !== null) return true
    if (col < 14 && board.cells[row][col + 1].letter !== null) return true
  }

  // Also check if the word passes through any existing tiles (inline with placed tiles)
  // This handles cases where placed tiles extend an existing word
  if (placed.length > 0) {
    const dr = placed.length > 1 && placed[1].row !== placed[0].row ? 1 : 0
    const dc = placed.length > 1 && placed[1].col !== placed[0].col ? 1 : 0
    if (dr === 0 && dc === 0) {
      // Single tile — already checked adjacency above
      return false
    }
    // Check if any cell between first and last placed tile has an existing letter
    let r = placed[0].row
    let c = placed[0].col
    const lastR = placed[placed.length - 1].row
    const lastC = placed[placed.length - 1].col
    while (r <= lastR && c <= lastC) {
      if (board.cells[r][c].letter !== null) return true
      r += dr
      c += dc
    }
  }

  return false
}

// Build and emit a scored move from placed tiles
function emitMove(
  board: BoardState,
  trie: TrieNode,
  placed: { row: number; col: number; letter: string; isBlank: boolean }[],
  direction: 'across' | 'down',
  moves: Move[],
): void {
  // Verify the move connects to existing tiles on the board
  if (!isConnected(board, placed)) return

  const score = scoreMove(board, placed, direction, trie)
  if (score === null) return

  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0

  // Find the start of the full word (including existing tiles before placed ones)
  let sr = placed[0].row
  let sc = placed[0].col
  while (sr - dr >= 0 && sc - dc >= 0 && board.cells[sr - dr][sc - dc].letter !== null) {
    sr -= dr
    sc -= dc
  }

  // Build the full word
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
