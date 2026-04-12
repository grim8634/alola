// Reference tile data for Scopely Scrabble app
// Colors calibrated from actual Scopely screenshots (1125x2436)

export interface TileReference {
  letter: string
  pixels: number[] // binarized pixels (0 or 1) — 1 = dark (letter ink)
  width: number
  height: number
}

// Actual Scopely colors sampled from screenshots:
// Empty cell:  rgb(232, 234, 241) — light blue-gray
// Placed tile: rgb(243, 218, 155) — warm golden
// DW bonus:    rgb(230, 181, 76)  — orange/gold
// DL bonus:    rgb(142, 194, 254) — light blue
// TL bonus:    rgb(66, 132, 208)  — medium blue
// TW bonus:    rgb(165, 84, 108)  — mauve/dark pink
// Grid border: rgb(244, 248, 255) — very light blue-white

// Color distance helper
export function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

// Check if a pixel looks like a placed tile (warm golden: ~243, 218, 155)
export function isTilePixel(r: number, g: number, b: number): boolean {
  return colorDistance(r, g, b, 243, 218, 155) < 45
}

// Check if a pixel is part of the board (any board-like color)
export function isBoardPixel(r: number, g: number, b: number): boolean {
  // Empty cell: light blue-gray ~(232, 234, 241)
  if (colorDistance(r, g, b, 232, 234, 241) < 25) return true
  // Placed tile: warm golden ~(243, 218, 155)
  if (isTilePixel(r, g, b)) return true
  // DW bonus: orange/gold ~(230, 181, 76)
  if (colorDistance(r, g, b, 230, 181, 76) < 40) return true
  // DL bonus: light blue ~(142, 194, 254)
  if (colorDistance(r, g, b, 142, 194, 254) < 40) return true
  // TL bonus: medium blue ~(66, 132, 208)
  if (colorDistance(r, g, b, 66, 132, 208) < 40) return true
  // TW bonus: mauve/dark pink ~(165, 84, 108)
  if (colorDistance(r, g, b, 165, 84, 108) < 40) return true
  // Grid lines / borders: light ~(243, 244, 248)
  if (colorDistance(r, g, b, 243, 244, 248) < 15) return true
  return false
}

// Generate reference letter templates by rendering on canvas
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

    // Clear with tile background color
    ctx.fillStyle = '#f3da9b'
    ctx.fillRect(0, 0, size, size)

    // Draw letter centered
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `bold ${Math.floor(size * 0.6)}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, size / 2, size / 2 - 1)

    const imageData = ctx.getImageData(0, 0, size, size)
    const pixels: number[] = []
    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]
      pixels.push(gray < 128 ? 1 : 0)
    }

    refs.push({ letter, pixels, width: size, height: size })
  }

  cachedReferences = refs
  return refs
}
