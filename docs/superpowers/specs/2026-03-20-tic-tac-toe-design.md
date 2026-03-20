# Tic Tac Toe Game — Design Spec

## Overview

A mobile-first tic-tac-toe game at `/tic-tac-toe`, styled after the GiiKER electronic device — neon-glowing marks on a dark board. Supports two-player pass-the-phone and play-vs-computer, with two rule sets: classic and vanishing.

## File

Single page component: `app/pages/tic-tac-toe.vue`

No extracted utilities — all game logic, AI, and styling live in this one file.

## Game Modes

Four modes, presented as a selector above the board:

| Mode | Rules | Opponent |
|------|-------|----------|
| Classic | Standard tic-tac-toe | Local 2-player |
| Classic vs Computer | Standard tic-tac-toe | AI |
| Vanishing | 3-mark limit per player | Local 2-player |
| Vanishing vs Computer | 3-mark limit per player | AI |

Default mode: Classic. Switching modes resets the board.

## Classic Rules

- 3x3 board, X always goes first
- Players alternate placing marks on empty cells
- First to get 3 in a row (row, column, or diagonal) wins
- If all 9 cells are filled with no winner, the game is a draw

## Vanishing Rules

- Same 3x3 board, X goes first
- Each player can have at most 3 marks on the board
- When a player already has 3 marks and places a 4th, their oldest mark is removed simultaneously
- The oldest mark enters a "fading" visual state when the player has 3 marks on the board, signaling it will vanish on the next move
- Players cannot place on the fading cell — it is still occupied until removed
- After the oldest mark is removed (step 2 of turn flow), its cell becomes empty and is a valid placement target for that same move
- Win detection runs after each placement (after old mark removal), checking the 3 marks currently on board
- No draws are possible — game continues until someone wins
- No score tracking — each game is standalone

## Page Structure

Follows existing site patterns:

1. **Header**: Small accent label ("GAME") + title ("Tic Tac Toe") with staggered reveal animations
2. **Divider**: `h-px bg-ink-faint/20 rule-reveal`
3. **Mode selector**: Four mode buttons, active mode gets accent highlight
4. **Game board**: Centered card container with the 3x3 grid
5. **Status line**: Whose turn it is, or winner/draw announcement
6. **Reset button**: Accent-styled, resets current game

Uses `useHead()` for SEO metadata. No nav header link — standalone route.

## Visual Design

Hybrid GiiKer aesthetic with site brand colors:

### Board
- Card container: `bg-surface-raised border border-ink-faint/10 rounded-lg`
- Grid lines: White/semi-transparent, achieved via CSS grid gap with background showing through
- Cell backgrounds: Dark (`#0a0a0a` or similar)

### X Marks
- Color: `#f59e0b` (site accent-light / amber)
- Drawn with CSS (two rotated bars forming an X)
- Glow: `0 0 12px #f59e0b, 0 0 28px rgba(245,158,11,0.4)`

### O Marks
- Color: `#22d3ee` (cyan — local to this component's scoped styles, not a design-system token)
- CSS circle: `border: 4px solid #22d3ee; border-radius: 50%`
- Glow: `0 0 12px #22d3ee, 0 0 24px rgba(34,211,238,0.4), inset 0 0 8px rgba(34,211,238,0.3)`

### Animations
- **Placement**: Marks scale in from 0 with ~200ms ease-out
- **Win highlight**: Winning cells get a brighter glow pulse; non-winning cells dim
- **Fading mark** (vanishing mode): Dimmed glow + slow pulse animation on the oldest mark when player has 3 on board
- **Removal** (vanishing mode): Mark fades out as new one appears

## State

All reactive refs in `<script setup>`:

- `board`: Array of 9 cells — `null`, `'X'`, or `'O'`
- `currentPlayer`: `'X'` or `'O'` (X always first)
- `gameMode`: `'classic'`, `'classic-vs-computer'`, `'vanishing'`, or `'vanishing-vs-computer'`
- `winner`: `null`, `'X'`, `'O'`, or `'draw'`
- `winningCells`: Array of indices for win highlight
- `moveHistory`: Object tracking placement order per player — `{ X: [cellIndex, ...], O: [cellIndex, ...] }` (used in vanishing mode, but maintained in all modes for simplicity)

Derived (computed):
- `fadingCell`: For vanishing modes, the index of the current player's oldest mark when they have 3 marks on board (`moveHistory[currentPlayer][0]`), otherwise `null`. Used for visual styling and click-rejection.

## Turn Flow

1. Player taps empty cell (not a fading cell)
2. In vanishing mode: if player has 3 marks, remove their oldest mark — set `board[moveHistory[player][0]]` to `null` and shift the index off the front of `moveHistory[player]`
3. Place new mark on tapped cell, push cell index to `moveHistory[player]`
4. Check for win (all 8 lines) or draw (classic only, all cells filled)
5. If game over, show result and stop
6. Switch to other player's turn
7. In computer modes: after player X moves, AI moves after ~400ms delay (includes any visual removal animation)
8. Board is non-interactive during AI delay and after game ends

## AI Logic

Simple but competent, evaluated in priority order:

1. **Win**: If AI can win this turn, take the winning cell
2. **Block**: If opponent can win next turn, block it
3. **Center**: If center (cell 4) is open, take it
4. **Corner**: If any corner (cells 0, 2, 6, 8) is open, take one
5. **Any**: Take any remaining open cell

In vanishing mode, the AI simulates mark removal before evaluating each candidate move. The same priority order applies (win, block, center, corner, any), but win and block checks are evaluated against the board state *after* the vanishing removal for both players. A block is skipped if the opponent's threatening mark is their oldest and will vanish on their next turn.

## Responsive / Mobile

- **Cell size**: Minimum 80px on mobile, ~100px on sm+
- **Board sizing**: `w-full max-w-[300px]` mobile, `max-w-[360px]` sm+, centered
- **Touch targets**: All interactive elements large enough for comfortable tapping
- **No horizontal scroll**: Everything within mobile viewport
- **Pass-the-phone UX**: Clear status announcing whose turn is next

## Accessibility

- Cells should have `aria-label` describing position and state (e.g., "Row 1, Column 2: X")
- Status line should use `aria-live="polite"` so screen readers announce turn changes and results

## Win Detection

Check all 8 winning lines against current board state:
- Rows: [0,1,2], [3,4,5], [6,7,8]
- Columns: [0,3,6], [1,4,7], [2,5,8]
- Diagonals: [0,4,8], [2,4,6]

A line wins if all three cells contain the same non-null mark.
