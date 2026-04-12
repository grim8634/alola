# Scrabble Solver — Design Spec

## Overview

A client-side Scrabble move analyzer that lives at `/scrabble-solver` on the portfolio site. The user uploads a screenshot from the Scrabble app (by Scopely), the tool parses the board state and rack using canvas-based template matching, and displays the top 10 highest-scoring moves.

## User Flow

1. **Upload** — User drags, drops, pastes, or file-picks a Scopely Scrabble screenshot
2. **Parse** — Client-side canvas template matching extracts the 15x15 board and 7-tile rack
3. **Display & Solve** — Parsed board is rendered as an interactive grid. The solver runs in a Web Worker and returns the top 10 moves, displayed in a list below the board. The first result is auto-selected and highlighted on the board.
4. **Correct & Re-solve** — Low-confidence cells are visually flagged. The user can click any cell to correct it, then re-solve.

## Screenshot Parsing Engine

### Board Detection
- Detect the board region by identifying the distinctive Scopely board border/pattern via pixel color sampling
- Once bounds are found, divide into a 15x15 grid

### Cell Classification
For each cell, sample pixel colors to determine:
- **Empty** — matches board square colors (beige, pink, blue, red depending on bonus type)
- **Has tile** — matches the Scopely tile color (consistent tan/cream)

For cells with tiles, crop the letter area and compare against a reference set of A-Z tile images using pixel similarity (normalized cross-correlation or simple pixel difference).

### Rack Detection
- The rack sits below the board in a known position relative to the board bounds
- Same tile-matching process for up to 7 tiles

### Reference Tile Set
- Built during development: take Scopely Scrabble screenshots containing all 26 letters, crop each letter tile, and store as pixel data arrays in `tiles.ts`
- Each reference tile is a small grayscale pixel grid (roughly 20x20px) representing just the letter portion of the tile
- This is a one-time manual effort — the reference data ships as part of the source code, not as runtime assets

### Confidence Scoring
- Each cell match gets a confidence score based on similarity to the best-matching reference tile
- Low-confidence cells are visually flagged (e.g. orange border) so the user knows to check them
- If board detection fails entirely (wrong app, bad crop), show a clear error message

## Scrabble Solver Engine

### Dictionary
- TWL06 (Tournament Word List, 2014 edition) for standard English Scrabble — the current official tournament dictionary
- Sourced from a freely available TWL06 word list file, converted to a JSON array at build time
- Stored as a compressed Trie structure in a static JSON file
- Loaded once into the Web Worker on first use (~1-2MB compressed)

### Move Generation
- For each anchor square (empty square adjacent to an existing tile, or center square on an empty board):
  - Try placing tiles horizontally and vertically
  - Walk the Trie to find valid words using available rack letters
  - Validate all cross-words (perpendicular words formed) are also valid
- Handle blank tiles (wildcards) by trying all 26 letter substitutions

### Scoring
- Standard Scrabble letter values (A=1, B=3, C=3, etc.)
- Bonus squares: Double Letter (DL), Triple Letter (TL), Double Word (DW), Triple Word (TW)
- Bonus squares only count on the turn a tile is placed on them
- 50-point bingo bonus for using all 7 rack tiles
- Bonus square positions are hardcoded (standard Scrabble board layout)

### Output
- Top 10 moves ranked by score
- Each move includes: word formed, board position (row/col), direction (across/down), total score, letters used from rack

### Performance
- Trie traversal with pruning — expected solve time under 500ms
- Runs in a Web Worker to keep UI responsive

## UI Design

### Layout
- Stacked layout: board on top, results below
- Matches existing site design system (dark theme, `surface`/`ink`/`accent` tokens, Syne + Lora fonts)

### Upload Area
- Drag-and-drop zone at the top of the page
- Click to open file picker
- Supports clipboard paste (Ctrl+V / Cmd+V)

### Parsed Board Display
- Interactive 15x15 grid
- Existing tiles shown in a solid tile style
- Empty squares show bonus labels (DW, TL, etc.) with appropriate background colors
- Low-confidence tiles highlighted with a distinct border
- Click any cell to correct the parsed letter (small inline input)
- Rack letters displayed below the board, also editable

### Results List
- Top 10 moves listed below the board
- Each entry shows: word, score, position, direction
- Click a move to highlight the tiles it would place on the board (using the `accent` color to distinguish from existing tiles)
- First result auto-selected on initial solve

### Re-solve
- After correcting any cells, a "Re-solve" button appears to recompute moves

## Technical Architecture

### File Structure
```
app/
  pages/
    scrabble-solver.vue          # Main page component
  utils/
    scrabble/
      board.ts                   # Board state types, bonus square map, scoring constants
      parser.ts                  # Screenshot parsing (canvas template matching)
      trie.ts                    # Trie data structure for dictionary lookup
      solver.ts                  # Move generation and scoring algorithm
      solver.worker.ts           # Web Worker wrapper for solver
      tiles.ts                   # Reference tile pixel data for Scopely matching
public/
  scrabble/
    dictionary.json              # Compressed TWL word list
    reference-tiles/             # Cropped tile images from Scopely (A-Z)
```

### Data Flow
```
Screenshot → Canvas → Parser (crop cells, match tiles)
                         ↓
                    Board State (15x15 grid + rack)
                         ↓
              Solver Worker (Trie + move generation)
                         ↓
                  Top 10 Moves (word, position, score)
```

### Dependencies
- No external dependencies beyond what the Nuxt project already has
- Uses browser Canvas API for image processing
- Uses Web Workers for background computation
- All Vue composables for state management

## Constraints

- **Client-side only** — no API keys, no server calls
- **Single app support** — optimized for Scopely Scrabble screenshots only
- **Standard Scrabble rules** — TWL dictionary, standard board layout and scoring
- **Dark theme only** — consistent with the rest of the site
