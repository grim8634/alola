import { type BoardState, BOARD_SIZE, createEmptyBoard } from './board'
import { isTilePixel, isDarkPixel, colorDistance } from './tiles'
import Tesseract from 'tesseract.js'

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

// Check if a pixel matches the TW (Triple Word) square color
function isTWPixel(r: number, g: number, b: number): boolean {
  return colorDistance(r, g, b, 165, 84, 108) < 35
}

// Detect the board region by finding TW corner squares
function detectBoardBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
  const step = Math.max(1, Math.floor(height / 400))

  let minTWy = height, maxTWy = 0, minTWx = width, maxTWx = 0
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

  const size = maxTWx - minTWx
  const x = minTWx
  const y = maxTWy - size

  if (size < width * 0.3) return null

  return { x, y, size }
}

// Check if a cell contains a tile
function hasTile(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellSize: number,
): boolean {
  const margin = Math.floor(cellSize * 0.08)
  const innerX = Math.floor(cellX) + margin
  const innerY = Math.floor(cellY) + margin
  const innerSize = Math.floor(cellSize) - 2 * margin

  if (innerSize <= 2) return false

  const imageData = ctx.getImageData(innerX, innerY, innerSize, innerSize)
  const data = imageData.data

  let tilePixels = 0
  let darkPixels = 0
  const totalPixels = innerSize * innerSize

  for (let i = 0; i < data.length; i += 4) {
    if (isTilePixel(data[i], data[i + 1], data[i + 2])) tilePixels++
    if (isDarkPixel(data[i], data[i + 1], data[i + 2])) darkPixels++
  }

  const tileRatio = tilePixels / totalPixels
  const darkRatio = darkPixels / totalPixels

  return tileRatio > 0.15 || (darkRatio > 0.08 && tileRatio > 0.05)
}

// Prepare a cell image for OCR: high-contrast black letter on white background
function prepareCellForOCR(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellSize: number,
): HTMLCanvasElement {
  const margin = Math.floor(cellSize * 0.08)
  const innerX = Math.floor(cellX) + margin
  const innerY = Math.floor(cellY) + margin
  const innerSize = Math.floor(cellSize) - 2 * margin

  // Crop out bottom-right 20% (subscript point value)
  const cropSize = Math.floor(innerSize * 0.8)

  const cellCanvas = document.createElement('canvas')
  // Scale up for better OCR accuracy
  const scale = 3
  cellCanvas.width = cropSize * scale
  cellCanvas.height = cropSize * scale
  const cellCtx = cellCanvas.getContext('2d')!

  // Draw scaled up
  cellCtx.drawImage(
    ctx.canvas,
    innerX, innerY, cropSize, cropSize,
    0, 0, cropSize * scale, cropSize * scale,
  )

  // Binarize: dark pixels → black, everything else → white
  const imageData = cellCtx.getImageData(0, 0, cellCanvas.width, cellCanvas.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const val = gray < 130 ? 0 : 255
    data[i] = val
    data[i + 1] = val
    data[i + 2] = val
    data[i + 3] = 255
  }
  cellCtx.putImageData(imageData, 0, 0)

  return cellCanvas
}

// Recognize letters in tile cells using Tesseract.js
async function recognizeTiles(
  ctx: CanvasRenderingContext2D,
  tileCells: { row: number; col: number; cellX: number; cellY: number }[],
  cellSize: number,
): Promise<Map<string, { letter: string; confidence: number }>> {
  const results = new Map<string, { letter: string; confidence: number }>()

  if (tileCells.length === 0) return results

  // Create a composite image with all tile cells arranged in a strip
  // This is faster than calling Tesseract once per cell
  const margin = Math.floor(cellSize * 0.08)
  const innerSize = Math.floor(cellSize) - 2 * margin
  const cropSize = Math.floor(innerSize * 0.8)
  const scale = 3
  const cellPx = cropSize * scale
  const padding = 10 // white padding between cells for Tesseract

  const compositeCanvas = document.createElement('canvas')
  const cols = Math.min(tileCells.length, 10)
  const rows = Math.ceil(tileCells.length / cols)
  compositeCanvas.width = cols * (cellPx + padding) + padding
  compositeCanvas.height = rows * (cellPx + padding) + padding
  const compCtx = compositeCanvas.getContext('2d')!

  // Fill with white
  compCtx.fillStyle = '#ffffff'
  compCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height)

  // Draw each cell
  for (let i = 0; i < tileCells.length; i++) {
    const { cellX, cellY } = tileCells[i]
    const cellCanvas = prepareCellForOCR(ctx, cellX, cellY, cellSize)
    const col = i % cols
    const row = Math.floor(i / cols)
    const dx = padding + col * (cellPx + padding)
    const dy = padding + row * (cellPx + padding)
    compCtx.drawImage(cellCanvas, dx, dy)
  }

  // Run Tesseract on the composite image
  try {
    const { data } = await Tesseract.recognize(compositeCanvas, 'eng', {
      logger: () => {}, // suppress logging
    })

    // Parse Tesseract results — extract individual characters
    // Since cells are laid out in a grid, map characters back by position
    if (data.symbols) {
      for (const symbol of data.symbols) {
        if (!symbol.text || symbol.text.trim().length === 0) continue
        const char = symbol.text.trim().toUpperCase()
        if (!/^[A-Z]$/.test(char)) continue

        // Find which cell this character belongs to based on its position
        const cx = (symbol.bbox.x0 + symbol.bbox.x1) / 2
        const cy = (symbol.bbox.y0 + symbol.bbox.y1) / 2
        const col = Math.floor((cx - padding) / (cellPx + padding))
        const row = Math.floor((cy - padding) / (cellPx + padding))
        const idx = row * cols + col

        if (idx >= 0 && idx < tileCells.length) {
          const key = `${tileCells[idx].row},${tileCells[idx].col}`
          const conf = symbol.confidence / 100
          // Keep highest confidence match per cell
          if (!results.has(key) || conf > results.get(key)!.confidence) {
            results.set(key, { letter: char, confidence: conf })
          }
        }
      }
    }
  } catch {
    // Tesseract failed — fall back to individual cell recognition
    for (const tile of tileCells) {
      const cellCanvas = prepareCellForOCR(ctx, tile.cellX, tile.cellY, cellSize)
      try {
        const { data } = await Tesseract.recognize(cellCanvas, 'eng', {
          logger: () => {},
        })
        const text = data.text.trim().toUpperCase()
        if (/^[A-Z]$/.test(text)) {
          results.set(`${tile.row},${tile.col}`, {
            letter: text,
            confidence: data.confidence / 100,
          })
        }
      } catch {
        // Skip this cell
      }
    }
  }

  return results
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

    const cellSize = bounds.size / BOARD_SIZE
    const board = createEmptyBoard()
    const confidence: number[][] = []

    // First pass: detect which cells have tiles
    const tileCells: { row: number; col: number; cellX: number; cellY: number }[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      const rowConfidence: number[] = []
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cx = bounds.x + c * cellSize
        const cy = bounds.y + r * cellSize
        if (hasTile(ctx, cx, cy, cellSize)) {
          board.cells[r][c] = { letter: '?', isBlank: false }
          rowConfidence.push(0)
          tileCells.push({ row: r, col: c, cellX: cx, cellY: cy })
        } else {
          board.cells[r][c] = { letter: null, isBlank: false }
          rowConfidence.push(1)
        }
      }
      confidence.push(rowConfidence)
    }

    // Second pass: OCR on tile cells using Tesseract
    if (tileCells.length > 0) {
      const ocrResults = await recognizeTiles(ctx, tileCells, cellSize)
      for (const tile of tileCells) {
        const key = `${tile.row},${tile.col}`
        const result = ocrResults.get(key)
        if (result) {
          board.cells[tile.row][tile.col] = { letter: result.letter, isBlank: false }
          confidence[tile.row][tile.col] = result.confidence
        }
      }
    }

    // Parse rack — find rack region and OCR those tiles too
    const rackLetters = await parseRack(ctx, bounds.x, bounds.y, bounds.size, img.width, img.height, cellSize)
    board.rack = rackLetters

    return { board, confidence, error: null }
  } catch (err) {
    return {
      board: createEmptyBoard(),
      confidence: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
      error: `Failed to parse screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

// Parse rack tiles below the board
async function parseRack(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  boardSize: number,
  canvasWidth: number,
  canvasHeight: number,
  cellSize: number,
): Promise<string[]> {
  const searchStart = boardY + boardSize + Math.floor(boardSize * 0.02)
  const searchEnd = Math.min(canvasHeight, boardY + boardSize + Math.floor(boardSize * 0.4))
  const step = Math.max(1, Math.floor((searchEnd - searchStart) / 60))

  let rackY = -1
  for (let y = searchStart; y < searchEnd; y += step) {
    const lineData = ctx.getImageData(0, y, canvasWidth, 1).data
    let tileCount = 0
    for (let x = 0; x < canvasWidth; x++) {
      const i = x * 4
      if (isTilePixel(lineData[i], lineData[i + 1], lineData[i + 2])) tileCount++
    }
    if (tileCount / canvasWidth > 0.4) {
      rackY = y
      break
    }
  }

  if (rackY === -1) return []

  // Find vertical extent
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

  // OCR each rack tile
  const tileSize = rackHeight
  const gap = Math.floor(tileSize * 0.08)
  const totalWidth = 7 * tileSize + 6 * gap
  const startX = Math.floor((canvasWidth - totalWidth) / 2)

  const rackTiles: { row: number; col: number; cellX: number; cellY: number }[] = []
  for (let i = 0; i < 7; i++) {
    const tx = startX + i * (tileSize + gap)
    if (tx < 0 || tx + tileSize > canvasWidth) continue
    if (hasTile(ctx, tx, rackTop, tileSize)) {
      rackTiles.push({ row: 0, col: i, cellX: tx, cellY: rackTop })
    }
  }

  if (rackTiles.length === 0) return []

  const results = await recognizeTiles(ctx, rackTiles, tileSize)
  const letters: string[] = []
  for (const tile of rackTiles) {
    const key = `${tile.row},${tile.col}`
    const result = results.get(key)
    if (result) {
      letters.push(result.letter)
    }
  }

  return letters
}
