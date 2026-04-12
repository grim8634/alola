// Reference tile data for Scopely Scrabble app
// Each tile is represented as a grayscale pixel grid
// These values will be populated from actual Scopely screenshots

export interface TileReference {
  letter: string
  // Grayscale pixel values normalized to 0-255
  // Cropped to just the letter portion of the tile
  pixels: number[]
  width: number
  height: number
}

// Scopely tile background color (tan/cream) — for detecting tile vs empty
export const TILE_COLOR = { r: 230, g: 206, b: 168 }
export const TILE_COLOR_TOLERANCE = 40

// Board square colors for empty cell detection
export const BOARD_COLORS = {
  normal: { r: 205, g: 186, b: 150 },  // beige
  DL: { r: 120, g: 180, b: 200 },       // light blue
  TL: { r: 40, g: 90, b: 180 },         // dark blue
  DW: { r: 200, g: 120, b: 120 },       // pink
  TW: { r: 180, g: 50, b: 50 },         // red
}
export const BOARD_COLOR_TOLERANCE = 45

// Reference tiles — populated from Scopely screenshots during development
// For now, we'll use a simpler approach: compare extracted grayscale cell images
// against stored reference images using pixel difference scoring
export const REFERENCE_TILES: TileReference[] = []

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
