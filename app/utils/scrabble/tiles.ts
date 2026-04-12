// Reference tile data for Scopely Scrabble app
// Colors calibrated from actual Scopely screenshots

export interface TileReference {
  letter: string
  pixels: number[] // binarized pixels (0 or 1) — 1 = dark (letter ink)
  width: number
  height: number
}

// Scopely placed tile background color (warm cream/tan)
export const TILE_COLOR = { r: 228, g: 208, b: 165 }
export const TILE_COLOR_TOLERANCE = 35

// Scopely rack tile color (slightly more golden)
export const RACK_TILE_COLOR = { r: 235, g: 215, b: 165 }
export const RACK_TILE_COLOR_TOLERANCE = 40

// Board empty cell color (light gray)
export const BOARD_EMPTY_COLOR = { r: 220, g: 222, b: 228 }
export const BOARD_EMPTY_TOLERANCE = 20

// Board grid line / border color (medium gray)
export const BOARD_BORDER_COLOR = { r: 190, g: 195, b: 205 }

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

// Check if a pixel looks like a placed tile (warm cream/tan)
export function isTilePixel(r: number, g: number, b: number): boolean {
  // Placed tiles are warm-toned: R > G > B, with R in 200-250 range
  if (r < 190 || r > 255) return false
  if (g < 170 || g > 240) return false
  if (b < 130 || b > 200) return false
  // Must be warm: red channel significantly higher than blue
  if (r - b < 30) return false
  return true
}

// Check if a pixel is part of the board grid (light gray background)
export function isBoardGridPixel(r: number, g: number, b: number): boolean {
  // Board grid cells are neutral light gray
  const avg = (r + g + b) / 3
  if (avg < 200 || avg > 240) return false
  // Must be neutral (not colored like bonus squares)
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
  return maxDiff < 15
}

// Generate reference letter templates by rendering on canvas
// This avoids needing pre-built screenshot-based reference data
let cachedReferences: TileReference[] | null = null

export function generateReferenceLetters(size: number): TileReference[] {
  if (cachedReferences && cachedReferences[0]?.width === size) return cachedReferences

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const refs: TileReference[] = []

  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code)

    // Clear canvas with light background (simulating tile)
    ctx.fillStyle = '#e4d0a5'
    ctx.fillRect(0, 0, size, size)

    // Draw letter in dark color (simulating Scopely tile font)
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `bold ${Math.floor(size * 0.65)}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, size / 2, size / 2 - 1)

    // Extract binarized pixel data
    const imageData = ctx.getImageData(0, 0, size, size)
    const pixels: number[] = []
    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]
      // Binary threshold: dark pixels (letter ink) = 1, light pixels (background) = 0
      pixels.push(gray < 128 ? 1 : 0)
    }

    refs.push({ letter, pixels, width: size, height: size })
  }

  cachedReferences = refs
  return refs
}
