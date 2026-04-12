import { type BoardState, BOARD_SIZE, createEmptyBoard } from './board'
import {
  isTilePixel,
  isBoardGridPixel,
  generateReferenceLetters,
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

// Detect the board region in a Scopely Scrabble screenshot
// Strategy: find the large square region of light gray grid cells
function detectBoardBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
  const step = Math.max(1, Math.floor(height / 200))

  // Scan each row to find which rows are "board rows"
  // A board row has a high proportion of grid-colored or tile-colored pixels
  const rowScores: number[] = []
  for (let y = 0; y < height; y += step) {
    const lineData = ctx.getImageData(0, y, width, 1).data
    let boardPixels = 0
    for (let x = 0; x < width; x++) {
      const i = x * 4
      const r = lineData[i]
      const g = lineData[i + 1]
      const b = lineData[i + 2]
      if (isBoardGridPixel(r, g, b) || isTilePixel(r, g, b) || isBonusSquarePixel(r, g, b)) {
        boardPixels++
      }
    }
    rowScores.push(boardPixels / width)
  }

  // Find the contiguous region with high board pixel density
  // The board should be a tall block (roughly 50-60% of screen height)
  let bestStart = -1
  let bestEnd = -1
  let bestLength = 0

  let start = -1
  for (let i = 0; i < rowScores.length; i++) {
    if (rowScores[i] > 0.4) {
      if (start === -1) start = i
    } else {
      if (start !== -1) {
        const length = i - start
        if (length > bestLength) {
          bestStart = start
          bestEnd = i - 1
          bestLength = length
        }
        start = -1
      }
    }
  }
  // Check trailing segment
  if (start !== -1 && rowScores.length - start > bestLength) {
    bestStart = start
    bestEnd = rowScores.length - 1
    bestLength = bestEnd - bestStart + 1
  }

  if (bestStart === -1) return null

  const topY = bestStart * step
  const bottomY = bestEnd * step

  // Now find left and right boundaries by scanning columns in the board region
  const midY = Math.floor((topY + bottomY) / 2)
  const colData = ctx.getImageData(0, midY, width, 1).data
  let leftX = 0
  let rightX = width - 1

  // Find left edge: first column with board pixels
  for (let x = 0; x < width; x++) {
    const i = x * 4
    if (isBoardGridPixel(colData[i], colData[i + 1], colData[i + 2]) ||
        isTilePixel(colData[i], colData[i + 1], colData[i + 2]) ||
        isBonusSquarePixel(colData[i], colData[i + 1], colData[i + 2])) {
      leftX = x
      break
    }
  }
  // Find right edge
  for (let x = width - 1; x >= 0; x--) {
    const i = x * 4
    if (isBoardGridPixel(colData[i], colData[i + 1], colData[i + 2]) ||
        isTilePixel(colData[i], colData[i + 1], colData[i + 2]) ||
        isBonusSquarePixel(colData[i], colData[i + 1], colData[i + 2])) {
      rightX = x
      break
    }
  }

  const boardWidth = rightX - leftX
  const boardHeight = bottomY - topY

  // The board should be roughly square
  const size = Math.min(boardWidth, boardHeight)

  // Center the square within the detected region
  const x = leftX + Math.floor((boardWidth - size) / 2)
  const y = topY + Math.floor((boardHeight - size) / 2)

  // Sanity check: board should be at least 20% of screen width
  if (size < width * 0.2) return null

  return { x, y, size }
}

// Check if a pixel matches a bonus square color (DL, TL, DW, TW)
function isBonusSquarePixel(r: number, g: number, b: number): boolean {
  // DL — light blue: ~130-170, 190-220, 230-255
  if (r < 180 && g > 170 && b > 210 && b > r) return true
  // TL — darker blue: ~60-120, 100-160, 200-255
  if (r < 140 && b > 180 && b > r + 50) return true
  // DW — orange/gold: ~200-240, 170-210, 80-140
  if (r > 190 && g > 150 && b < 160 && r - b > 60) return true
  // TW — dark red: ~140-190, 60-100, 80-120
  if (r > 130 && r < 200 && g < 110 && b < 130 && r > g + 30) return true
  return false
}

// Classify a single cell: is it empty, or does it have a tile? If tile, what letter?
function classifyCell(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellSize: number,
  references: TileReference[],
): { letter: string | null; confidence: number } {
  // Sample the inner region (avoid grid lines at borders)
  const margin = Math.floor(cellSize * 0.12)
  const innerX = Math.floor(cellX) + margin
  const innerY = Math.floor(cellY) + margin
  const innerSize = Math.floor(cellSize) - 2 * margin

  if (innerSize <= 2) return { letter: null, confidence: 1 }

  const imageData = ctx.getImageData(innerX, innerY, innerSize, innerSize)
  const data = imageData.data

  // Count tile-colored pixels vs total
  let tilePixels = 0
  const totalPixels = innerSize * innerSize
  for (let i = 0; i < data.length; i += 4) {
    if (isTilePixel(data[i], data[i + 1], data[i + 2])) {
      tilePixels++
    }
  }

  const tileRatio = tilePixels / totalPixels

  // If less than 25% tile-colored, it's an empty cell (bonus square or plain)
  if (tileRatio < 0.25) {
    return { letter: null, confidence: 1 }
  }

  // Cell has a tile — identify the letter
  // Binarize: dark pixels = letter ink, light pixels = background
  const binarized: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    binarized.push(gray < 140 ? 1 : 0)
  }

  // Resize binarized data to match reference size
  const refSize = references[0].width
  const resized = resizeBinary(binarized, innerSize, innerSize, refSize, refSize)

  // Compare against each reference letter
  let bestMatch: TileReference | null = null
  let bestScore = -1

  for (const ref of references) {
    // Use normalized cross-correlation on binarized images
    let matches = 0
    let total = 0
    for (let i = 0; i < resized.length && i < ref.pixels.length; i++) {
      if (resized[i] === 1 || ref.pixels[i] === 1) {
        total++
        if (resized[i] === ref.pixels[i]) matches++
      }
    }
    const score = total > 0 ? matches / total : 0
    if (score > bestScore) {
      bestScore = score
      bestMatch = ref
    }
  }

  if (!bestMatch || bestScore < 0.15) {
    return { letter: '?', confidence: 0 }
  }

  return { letter: bestMatch.letter, confidence: bestScore }
}

// Resize a binary pixel array using nearest-neighbor
function resizeBinary(
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

// Parse rack tiles from below the board
function parseRack(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  boardSize: number,
  canvasWidth: number,
  canvasHeight: number,
  references: TileReference[],
): string[] {
  // The rack in Scopely is a row of 7 larger tiles below the board
  // Search for rack tiles by scanning below the board
  const searchStartY = boardY + boardSize + Math.floor(boardSize * 0.02)
  const searchEndY = Math.min(canvasHeight, boardY + boardSize + Math.floor(boardSize * 0.35))

  // Find the rack row: scan for a horizontal strip with many tile-colored pixels
  let rackY = -1
  const step = Math.max(1, Math.floor((searchEndY - searchStartY) / 50))

  for (let y = searchStartY; y < searchEndY; y += step) {
    const lineData = ctx.getImageData(0, y, canvasWidth, 1).data
    let tileCount = 0
    for (let x = 0; x < canvasWidth; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) {
        tileCount++
      }
    }
    if (tileCount / canvasWidth > 0.5) {
      rackY = y
      break
    }
  }

  if (rackY === -1) return []

  // Find the full vertical extent of the rack tiles
  let rackTop = rackY
  let rackBottom = rackY
  for (let y = rackY; y >= searchStartY; y--) {
    const lineData = ctx.getImageData(canvasWidth / 4, y, canvasWidth / 2, 1).data
    let tileCount = 0
    for (let x = 0; x < canvasWidth / 2; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) tileCount++
    }
    if (tileCount / (canvasWidth / 2) < 0.2) break
    rackTop = y
  }
  for (let y = rackY; y < searchEndY; y++) {
    const lineData = ctx.getImageData(canvasWidth / 4, y, canvasWidth / 2, 1).data
    let tileCount = 0
    for (let x = 0; x < canvasWidth / 2; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) tileCount++
    }
    if (tileCount / (canvasWidth / 2) < 0.2) break
    rackBottom = y
  }

  const rackHeight = rackBottom - rackTop
  if (rackHeight < 10) return []

  // Rack tiles are roughly square and evenly spaced across the screen
  const tileSize = rackHeight
  const totalRackWidth = tileSize * 7 + 6 * Math.floor(tileSize * 0.1) // tiles + gaps
  const rackStartX = Math.floor((canvasWidth - totalRackWidth) / 2)

  const letters: string[] = []
  const gap = Math.floor(tileSize * 0.1)

  for (let i = 0; i < 7; i++) {
    const tileX = rackStartX + i * (tileSize + gap)
    if (tileX < 0 || tileX + tileSize > canvasWidth) continue

    const result = classifyCell(ctx, tileX, rackTop, tileSize, references)
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

    // Detect board bounds
    const bounds = detectBoardBounds(ctx, img.width, img.height)
    if (!bounds) {
      return {
        board: createEmptyBoard(),
        confidence: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
        error: 'Could not detect the Scrabble board in this image. Make sure it\'s a screenshot from the Scopely Scrabble app.',
      }
    }

    // Generate reference letters for matching (render A-Z on canvas)
    const cellSize = bounds.size / BOARD_SIZE
    const refSize = Math.max(16, Math.floor(cellSize * 0.7))
    const references = generateReferenceLetters(refSize)

    // Parse each cell
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

    // Parse rack
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
