// Reference tile data for Scopely Scrabble app
// Colors calibrated from actual Scopely screenshots (1125x2436)
//
// Actual Scopely colors sampled:
// Empty cell:       rgb(232, 234, 241) — light blue-gray (COOL: B > R)
// Golden tile:      rgb(243, 218, 155) — warm golden
// White tile:       rgb(250, 245, 240) — opponent's last move (WARM: R > B)
// DW bonus:         rgb(230, 181, 76)  — orange/gold
// DL bonus:         rgb(142, 194, 254) — light blue
// TL bonus:         rgb(66, 132, 208)  — medium blue
// TW bonus:         rgb(165, 84, 108)  — mauve/dark pink

export interface TileReference {
  letter: string
  // Region-based features: dark pixel ratio in a 5x5 grid
  regions: number[]
}

// Color distance helper
export function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

// Check if a pixel is a golden placed tile (~243, 218, 155)
export function isGoldenTilePixel(r: number, g: number, b: number): boolean {
  return colorDistance(r, g, b, 243, 218, 155) < 45
}

// Check if a pixel is a white/opponent tile (~250, 245, 240)
// Distinguished from empty cells by warm tint: R > B
export function isWhiteTilePixel(r: number, g: number, b: number): boolean {
  const avg = (r + g + b) / 3
  // High brightness, warm tint (R > B), not too saturated
  return avg > 220 && r > 240 && r > b + 3 && g > 230
}

// Check if pixel is any kind of tile (golden or white)
export function isTilePixel(r: number, g: number, b: number): boolean {
  return isGoldenTilePixel(r, g, b) || isWhiteTilePixel(r, g, b)
}

// Check if pixel is dark (letter ink on a tile)
export function isDarkPixel(r: number, g: number, b: number): boolean {
  return (r + g + b) / 3 < 120
}

// Generate reference letter templates using region-based features
// Instead of pixel-exact comparison, we divide the cell into a 5x5 grid
// and compute the dark pixel ratio in each region. This is robust to font differences.
let cachedReferences: TileReference[] | null = null
let cachedSize = 0

export function generateReferenceLetters(size: number): TileReference[] {
  if (cachedReferences && cachedSize === size) return cachedReferences

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const refs: TileReference[] = []
  const gridSize = 5

  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code)

    // Clear with light background
    ctx.fillStyle = '#f0e0c0'
    ctx.fillRect(0, 0, size, size)

    // Draw letter centered — try to approximate Scopely's bold serif-ish font
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `bold ${Math.floor(size * 0.55)}px 'Georgia', 'Times New Roman', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, size / 2, size / 2)

    // Extract region-based features
    const imageData = ctx.getImageData(0, 0, size, size)
    const regions = extractRegions(imageData.data, size, size, gridSize)

    refs.push({ letter, regions })
  }

  cachedReferences = refs
  cachedSize = size
  return refs
}

// Extract dark pixel ratio in a gridSize x gridSize grid of regions
export function extractRegions(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
  gridSize: number,
  isRGBA: boolean = true,
): number[] {
  const regions: number[] = new Array(gridSize * gridSize).fill(0)
  const regionCounts: number[] = new Array(gridSize * gridSize).fill(0)
  const regionW = width / gridSize
  const regionH = height / gridSize

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const regionX = Math.min(Math.floor(x / regionW), gridSize - 1)
      const regionY = Math.min(Math.floor(y / regionH), gridSize - 1)
      const regionIdx = regionY * gridSize + regionX

      let gray: number
      if (isRGBA) {
        const i = (y * width + x) * 4
        gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
      } else {
        gray = pixels[y * width + x]
      }

      regionCounts[regionIdx]++
      if (gray < 120) {
        regions[regionIdx]++
      }
    }
  }

  // Convert counts to ratios
  for (let i = 0; i < regions.length; i++) {
    regions[i] = regionCounts[i] > 0 ? regions[i] / regionCounts[i] : 0
  }

  return regions
}

// Compare two region feature vectors — returns similarity 0 to 1
export function compareRegions(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let sumDiff = 0
  for (let i = 0; i < a.length; i++) {
    sumDiff += Math.abs(a[i] - b[i])
  }
  // Normalize: max possible diff per region is 1, total max = length
  return 1 - sumDiff / a.length
}
