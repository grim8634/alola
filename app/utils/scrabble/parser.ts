import { type BoardState, BOARD_SIZE, createEmptyBoard } from './board'
import {
  isTilePixel,
  isDarkPixel,
  colorDistance,
  generateReferenceLetters,
  extractRegions,
  compareRegions,
  type TileReference,
} from './tiles'

export interface ParseResult {
  board: BoardState
  confidence: number[][]
  error: string | null
}

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

// Check if a pixel matches the TW (Triple Word) square color — mauve/dark pink
// This is a distinctive color that ONLY appears on the board
function isTWPixel(r: number, g: number, b: number): boolean {
  return colorDistance(r, g, b, 165, 84, 108) < 35
}

// Detect the board region by finding TW corner squares
// TW squares appear at the 4 corners and edges of the Scrabble board
// Their distinctive mauve color doesn't appear elsewhere in the Scopely UI
function detectBoardBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
  const step = Math.max(1, Math.floor(height / 400))

  // Find all rows and columns that contain TW-colored pixels
  let minTWy = height
  let maxTWy = 0
  let minTWx = width
  let maxTWx = 0
  let foundTW = false

  for (let y = 0; y < height; y += step) {
    const lineData = ctx.getImageData(0, y, width, 1).data
    for (let x = 0; x < width; x++) {
      const i = x * 4
      if (isTWPixel(lineData[i], lineData[i + 1], lineData[i + 2])) {
        if (y < minTWy) minTWy = y
        if (y > maxTWy) maxTWy = y
        if (x < minTWx) minTWx = x
        if (x > maxTWx) maxTWx = x
        foundTW = true
      }
    }
  }

  if (!foundTW) return null

  // The board is square. Use the horizontal TW span as the authoritative size
  // since left/right edges are cleaner than top/bottom (less UI interference)
  const size = maxTWx - minTWx

  // Position: left edge from TW, top calculated from bottom TW edge minus size
  // This avoids any false TW matches above the board
  const x = minTWx
  const y = maxTWy - size

  // Sanity: board should be at least 30% of screen width
  if (size < width * 0.3) return null

  return { x, y, size }
}

// Classify a cell: empty or tile with letter
function classifyCell(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellSize: number,
  references: TileReference[],
): { letter: string | null; confidence: number } {
  const margin = Math.floor(cellSize * 0.08)
  const innerX = Math.floor(cellX) + margin
  const innerY = Math.floor(cellY) + margin
  const innerSize = Math.floor(cellSize) - 2 * margin

  if (innerSize <= 2) return { letter: null, confidence: 1 }

  const imageData = ctx.getImageData(innerX, innerY, innerSize, innerSize)
  const data = imageData.data

  // Count tile-colored pixels AND dark (letter ink) pixels
  let tilePixels = 0
  let darkPixels = 0
  const totalPixels = innerSize * innerSize
  for (let i = 0; i < data.length; i += 4) {
    if (isTilePixel(data[i], data[i + 1], data[i + 2])) {
      tilePixels++
    }
    if (isDarkPixel(data[i], data[i + 1], data[i + 2])) {
      darkPixels++
    }
  }

  const tileRatio = tilePixels / totalPixels
  const darkRatio = darkPixels / totalPixels

  // A cell has a tile if it has enough tile-colored background OR
  // enough dark pixels (letter ink) combined with some tile pixels
  const hasTile = tileRatio > 0.15 || (darkRatio > 0.08 && tileRatio > 0.05)

  if (!hasTile) {
    return { letter: null, confidence: 1 }
  }

  // Extract region-based features from this cell
  const gridSize = 5
  const cellRegions = extractRegions(data, innerSize, innerSize, gridSize)

  // Compare against each reference letter
  let bestMatch: TileReference | null = null
  let bestScore = -1

  for (const ref of references) {
    const score = compareRegions(cellRegions, ref.regions)
    if (score > bestScore) {
      bestScore = score
      bestMatch = ref
    }
  }

  if (!bestMatch || bestScore < 0.5) {
    return { letter: '?', confidence: 0 }
  }

  return { letter: bestMatch.letter, confidence: bestScore }
}

// Parse rack tiles below the board
function parseRack(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  boardSize: number,
  canvasWidth: number,
  canvasHeight: number,
  references: TileReference[],
): string[] {
  // Rack is below the board — scan for a row of tile-colored pixels
  const searchStart = boardY + boardSize + Math.floor(boardSize * 0.02)
  const searchEnd = Math.min(canvasHeight, boardY + boardSize + Math.floor(boardSize * 0.4))
  const step = Math.max(1, Math.floor((searchEnd - searchStart) / 60))

  let rackY = -1
  for (let y = searchStart; y < searchEnd; y += step) {
    const lineData = ctx.getImageData(0, y, canvasWidth, 1).data
    let tileCount = 0
    for (let x = 0; x < canvasWidth; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) {
        tileCount++
      }
    }
    if (tileCount / canvasWidth > 0.4) {
      rackY = y
      break
    }
  }

  if (rackY === -1) return []

  // Find vertical extent of rack
  let rackTop = rackY
  let rackBottom = rackY
  for (let y = rackY; y >= searchStart; y -= 2) {
    const lineData = ctx.getImageData(canvasWidth / 4, y, canvasWidth / 2, 1).data
    let tc = 0
    for (let x = 0; x < canvasWidth / 2; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) tc++
    }
    if (tc / (canvasWidth / 2) < 0.15) break
    rackTop = y
  }
  for (let y = rackY; y < searchEnd; y += 2) {
    const lineData = ctx.getImageData(canvasWidth / 4, y, canvasWidth / 2, 1).data
    let tc = 0
    for (let x = 0; x < canvasWidth / 2; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) tc++
    }
    if (tc / (canvasWidth / 2) < 0.15) break
    rackBottom = y
  }

  const rackHeight = rackBottom - rackTop
  if (rackHeight < 20) return []

  // 7 tiles roughly evenly spaced across the width
  const tileSize = rackHeight
  const gap = Math.floor(tileSize * 0.08)
  const totalWidth = 7 * tileSize + 6 * gap
  const startX = Math.floor((canvasWidth - totalWidth) / 2)

  const letters: string[] = []
  for (let i = 0; i < 7; i++) {
    const tx = startX + i * (tileSize + gap)
    if (tx < 0 || tx + tileSize > canvasWidth) continue
    const result = classifyCell(ctx, tx, rackTop, tileSize, references)
    if (result.letter && result.letter !== '?') {
      letters.push(result.letter)
    }
  }

  return letters
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

    const bounds = detectBoardBounds(ctx, img.width, img.height)
    if (!bounds) {
      return {
        board: createEmptyBoard(),
        confidence: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
        error: 'Could not detect the Scrabble board in this image. Make sure it\'s a screenshot from the Scopely Scrabble app.',
      }
    }

    const cellSize = bounds.size / BOARD_SIZE
    const refSize = Math.max(16, Math.floor(cellSize * 0.7))
    const references = generateReferenceLetters(refSize)

    const board = createEmptyBoard()
    const confidence: number[][] = []

    for (let r = 0; r < BOARD_SIZE; r++) {
      const rowConfidence: number[] = []
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cx = bounds.x + c * cellSize
        const cy = bounds.y + r * cellSize
        const result = classifyCell(ctx, cx, cy, cellSize, references)
        board.cells[r][c] = { letter: result.letter, isBlank: false }
        rowConfidence.push(result.confidence)
      }
      confidence.push(rowConfidence)
    }

    board.rack = parseRack(ctx, bounds.x, bounds.y, bounds.size, img.width, img.height, references)

    return { board, confidence, error: null }
  } catch (err) {
    return {
      board: createEmptyBoard(),
      confidence: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
      error: `Failed to parse screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}
