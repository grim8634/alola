import { type BoardState, BOARD_SIZE, createEmptyBoard } from './board'
import {
  isTilePixel,
  isBoardPixel,
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
function detectBoardBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
  const step = Math.max(1, Math.floor(height / 300))

  // Score each row by how many pixels look like board content
  const rowScores: { y: number; score: number }[] = []
  for (let y = 0; y < height; y += step) {
    const lineData = ctx.getImageData(0, y, width, 1).data
    let boardPixels = 0
    for (let x = 0; x < width; x++) {
      const i = x * 4
      if (isBoardPixel(lineData[i], lineData[i + 1], lineData[i + 2])) {
        boardPixels++
      }
    }
    rowScores.push({ y, score: boardPixels / width })
  }

  // Find the longest contiguous stretch of rows with high board pixel density
  let bestStart = -1
  let bestEnd = -1
  let bestLength = 0
  let start = -1

  for (let i = 0; i < rowScores.length; i++) {
    if (rowScores[i].score > 0.6) {
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
  if (start !== -1 && rowScores.length - start > bestLength) {
    bestStart = start
    bestEnd = rowScores.length - 1
    bestLength = bestEnd - bestStart + 1
  }

  if (bestStart === -1 || bestLength < 10) return null

  const topY = rowScores[bestStart].y
  const bottomY = rowScores[bestEnd].y

  // Find left and right boundaries by scanning columns at multiple board rows
  let leftX = width
  let rightX = 0

  for (const rowIdx of [bestStart, Math.floor((bestStart + bestEnd) / 2), bestEnd]) {
    const y = rowScores[rowIdx].y
    const lineData = ctx.getImageData(0, y, width, 1).data

    for (let x = 0; x < width; x++) {
      const i = x * 4
      if (isBoardPixel(lineData[i], lineData[i + 1], lineData[i + 2])) {
        if (x < leftX) leftX = x
        if (x > rightX) rightX = x
      }
    }
  }

  const boardWidth = rightX - leftX
  const boardHeight = bottomY - topY

  // The board is square — use the smaller dimension
  const size = Math.min(boardWidth, boardHeight)

  // Center the square within the detected region
  const x = leftX + Math.floor((boardWidth - size) / 2)
  const y = topY + Math.floor((boardHeight - size) / 2)

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
  const margin = Math.floor(cellSize * 0.1)
  const innerX = Math.floor(cellX) + margin
  const innerY = Math.floor(cellY) + margin
  const innerSize = Math.floor(cellSize) - 2 * margin

  if (innerSize <= 2) return { letter: null, confidence: 1 }

  const imageData = ctx.getImageData(innerX, innerY, innerSize, innerSize)
  const data = imageData.data

  // Count tile-colored pixels
  let tilePixels = 0
  const totalPixels = innerSize * innerSize
  for (let i = 0; i < data.length; i += 4) {
    if (isTilePixel(data[i], data[i + 1], data[i + 2])) {
      tilePixels++
    }
  }

  const tileRatio = tilePixels / totalPixels
  if (tileRatio < 0.2) {
    return { letter: null, confidence: 1 }
  }

  // Cell has a tile — identify the letter using binarized comparison
  // Dark pixels on the tile are letter ink
  const binarized: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    binarized.push(gray < 140 ? 1 : 0)
  }

  // Resize to reference size
  const refSize = references[0].width
  const resized = resizeBinary(binarized, innerSize, innerSize, refSize, refSize)

  // Compare against each reference letter
  let bestMatch: TileReference | null = null
  let bestScore = -1

  for (const ref of references) {
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

  if (!bestMatch || bestScore < 0.1) {
    return { letter: '?', confidence: 0 }
  }

  return { letter: bestMatch.letter, confidence: bestScore }
}

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
