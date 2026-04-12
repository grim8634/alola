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
  regions: number[]      // 7x7 grid features
  colProfile: number[]   // dark pixel count per column (normalized)
  rowProfile: number[]   // dark pixel count per row (normalized)
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
// Renders each letter, finds its bounding box, normalizes, then extracts
// features on a 7x7 grid for good discrimination between similar letters.
let cachedReferences: TileReference[] | null = null
let cachedSize = 0

export const GRID_SIZE = 7

export function generateReferenceLetters(size: number): TileReference[] {
  if (cachedReferences && cachedSize === size) return cachedReferences

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const refs: TileReference[] = []

  // Try multiple fonts to increase match likelihood
  const fonts = [
    `bold ${Math.floor(size * 0.6)}px 'Georgia', serif`,
    `bold ${Math.floor(size * 0.6)}px Arial, sans-serif`,
    `bold ${Math.floor(size * 0.55)}px 'Times New Roman', serif`,
  ]

  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code)
    let bestRegions: number[] = []
    let lastImageData: ImageData | null = null

    for (const font of fonts) {
      ctx.fillStyle = '#f0e0c0'
      ctx.fillRect(0, 0, size, size)

      ctx.fillStyle = '#1a1a1a'
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, size / 2, size / 2)

      lastImageData = ctx.getImageData(0, 0, size, size)
      const regions = extractNormalizedRegions(lastImageData.data, size, size, GRID_SIZE)
      if (bestRegions.length === 0) bestRegions = regions
    }

    const profiles = extractProfiles(lastImageData!.data, size, size, PROFILE_BINS)
    refs.push({ letter, regions: bestRegions, colProfile: profiles.col, rowProfile: profiles.row })
  }

  cachedReferences = refs
  cachedSize = size
  return refs
}

// Extract regions from bounding box of dark pixels only (normalized)
// This makes comparison position-independent and ignores subscript numbers
export function extractNormalizedRegions(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
  gridSize: number,
  isRGBA: boolean = true,
  skipSubscript: boolean = false,
): number[] {
  // First pass: find bounding box of dark pixels
  let minX = width, maxX = 0, minY = height, maxY = 0
  const cropW = skipSubscript ? Math.floor(width * 0.82) : width
  const cropH = skipSubscript ? Math.floor(height * 0.82) : height

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      let gray: number
      if (isRGBA) {
        const i = (y * width + x) * 4
        gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
      } else {
        gray = pixels[y * width + x]
      }
      if (gray < 120) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (minX >= maxX || minY >= maxY) {
    return new Array(gridSize * gridSize).fill(0)
  }

  // Add small padding
  const pad = 2
  minX = Math.max(0, minX - pad)
  maxX = Math.min(cropW - 1, maxX + pad)
  minY = Math.max(0, minY - pad)
  maxY = Math.min(cropH - 1, maxY + pad)

  const bboxW = maxX - minX + 1
  const bboxH = maxY - minY + 1

  // Second pass: extract regions within bounding box
  const regions: number[] = new Array(gridSize * gridSize).fill(0)
  const counts: number[] = new Array(gridSize * gridSize).fill(0)
  const regionW = bboxW / gridSize
  const regionH = bboxH / gridSize

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let gray: number
      if (isRGBA) {
        const i = (y * width + x) * 4
        gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
      } else {
        gray = pixels[y * width + x]
      }

      const rx = Math.min(Math.floor((x - minX) / regionW), gridSize - 1)
      const ry = Math.min(Math.floor((y - minY) / regionH), gridSize - 1)
      const idx = ry * gridSize + rx

      counts[idx]++
      if (gray < 120) {
        regions[idx]++
      }
    }
  }

  for (let i = 0; i < regions.length; i++) {
    regions[i] = counts[i] > 0 ? regions[i] / counts[i] : 0
  }

  return regions
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
  return 1 - sumDiff / a.length
}

// Profile-based features: count dark pixels per column and row
// Resample to `bins` values for consistent comparison
export const PROFILE_BINS = 12

export function extractProfiles(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
  bins: number,
  isRGBA: boolean = true,
  skipSubscript: boolean = false,
): { col: number[]; row: number[] } {
  const cropW = skipSubscript ? Math.floor(width * 0.82) : width
  const cropH = skipSubscript ? Math.floor(height * 0.82) : height

  // Find bounding box
  let minX = cropW, maxX = 0, minY = cropH, maxY = 0
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      let gray: number
      if (isRGBA) {
        const i = (y * width + x) * 4
        gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
      } else {
        gray = pixels[y * width + x]
      }
      if (gray < 120) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (minX >= maxX || minY >= maxY) {
    return { col: new Array(bins).fill(0), row: new Array(bins).fill(0) }
  }

  const bboxW = maxX - minX + 1
  const bboxH = maxY - minY + 1

  // Raw column and row counts within bounding box
  const colCounts = new Array(bboxW).fill(0)
  const rowCounts = new Array(bboxH).fill(0)

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let gray: number
      if (isRGBA) {
        const i = (y * width + x) * 4
        gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
      } else {
        gray = pixels[y * width + x]
      }
      if (gray < 120) {
        colCounts[x - minX]++
        rowCounts[y - minY]++
      }
    }
  }

  // Resample to `bins` using averaging
  const col = resampleProfile(colCounts, bins, bboxH)
  const row = resampleProfile(rowCounts, bins, bboxW)

  return { col, row }
}

function resampleProfile(counts: number[], bins: number, maxCount: number): number[] {
  const result = new Array(bins).fill(0)
  const binSize = counts.length / bins

  for (let b = 0; b < bins; b++) {
    const start = Math.floor(b * binSize)
    const end = Math.floor((b + 1) * binSize)
    let sum = 0
    let n = 0
    for (let i = start; i < end && i < counts.length; i++) {
      sum += counts[i]
      n++
    }
    result[b] = n > 0 && maxCount > 0 ? (sum / n) / maxCount : 0
  }

  return result
}

// Combined comparison: regions + profiles
export function compareLetterFeatures(
  cellRegions: number[],
  cellCol: number[],
  cellRow: number[],
  ref: TileReference,
): number {
  const regionSim = compareRegions(cellRegions, ref.regions)
  const colSim = compareRegions(cellCol, ref.colProfile)
  const rowSim = compareRegions(cellRow, ref.rowProfile)
  // Weight profiles higher — they're more discriminating
  return regionSim * 0.3 + colSim * 0.35 + rowSim * 0.35
}
