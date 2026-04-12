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

function detectBoardBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
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

  const size = bottomY - topY
  const x = Math.floor((width - size) / 2)

  return { x, y: topY, size }
}

function isBoardOrTileColor(r: number, g: number, b: number): boolean {
  if (colorMatches(r, g, b, TILE_COLOR, TILE_COLOR_TOLERANCE)) return true
  const brightness = (r + g + b) / 3
  if (brightness > 40 && brightness < 230) return true
  return false
}

function classifyCell(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellSize: number,
): { letter: string | null; confidence: number } {
  const margin = Math.floor(cellSize * 0.15)
  const innerX = cellX + margin
  const innerY = cellY + margin
  const innerSize = cellSize - 2 * margin

  if (innerSize <= 0) return { letter: null, confidence: 1 }

  const imageData = ctx.getImageData(innerX, innerY, innerSize, innerSize)
  const data = imageData.data

  let tilePixels = 0
  const totalPixels = innerSize * innerSize
  for (let i = 0; i < data.length; i += 4) {
    if (colorMatches(data[i], data[i + 1], data[i + 2], TILE_COLOR, TILE_COLOR_TOLERANCE)) {
      tilePixels++
    }
  }

  const tileRatio = tilePixels / totalPixels
  if (tileRatio < 0.2) {
    return { letter: null, confidence: 1 }
  }

  if (REFERENCE_TILES.length === 0) {
    return { letter: '?', confidence: 0 }
  }

  const grayscale: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    grayscale.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]))
  }

  const ref = REFERENCE_TILES[0]
  const resized = resizeGrayscale(grayscale, innerSize, innerSize, ref.width, ref.height)

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

  const confidence = Math.max(0, Math.min(1, 1 - bestScore / 128))

  return { letter: bestMatch.letter, confidence }
}

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

function parseRack(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  boardSize: number,
  canvasHeight: number,
): { letters: string[]; confidence: number[] } {
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
