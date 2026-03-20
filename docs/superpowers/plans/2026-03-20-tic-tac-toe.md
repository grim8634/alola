# Tic Tac Toe Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first tic-tac-toe game at `/tic-tac-toe` with classic and vanishing modes, local 2-player and vs-computer, styled after the GiiKer device.

**Architecture:** Single page component `app/pages/tic-tac-toe.vue` containing all game logic, AI, state, and scoped styles. No extracted files. Follows existing Nuxt 4 page patterns (see `app/pages/projects.vue` for reference).

**Tech Stack:** Nuxt 4, Vue 3 (`<script setup>`), Tailwind CSS, scoped CSS for glow animations.

**Spec:** `docs/superpowers/specs/2026-03-20-tic-tac-toe-design.md`

**No test framework** is configured for this project, so there are no TDD steps. Manual verification in browser instead.

---

## File Structure

- **Create:** `app/pages/tic-tac-toe.vue` — single page component with all game logic, UI, and scoped styles

No other files created or modified.

---

### Task 1: Page scaffold with header, mode selector, and empty board

**Files:**
- Create: `app/pages/tic-tac-toe.vue`

- [ ] **Step 1: Create the page file with template scaffold**

Write `app/pages/tic-tac-toe.vue` with:

```vue
<template>
  <div>
    <!-- Header -->
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Game
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Tic Tac Toe
      </h1>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <!-- Mode selector -->
    <div class="flex flex-wrap gap-2 pt-8 pb-6 reveal reveal-d3">
      <button
        v-for="mode in modes"
        :key="mode.value"
        class="font-display text-xs font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-md transition-colors"
        :class="gameMode === mode.value
          ? 'bg-accent text-surface'
          : 'text-ink-muted hover:text-ink border border-ink-faint/20'"
        @click="setMode(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>

    <!-- Board -->
    <div class="flex justify-center reveal reveal-d4">
      <div class="w-full max-w-[300px] sm:max-w-[360px] bg-surface-raised border border-ink-faint/10 rounded-lg p-3">
        <div class="grid grid-cols-3 gap-[2px] bg-white/20 rounded">
          <button
            v-for="(cell, i) in board"
            :key="i"
            class="aspect-square bg-[#0a0a0a] flex items-center justify-center"
            :class="[
              i === 0 && 'rounded-tl',
              i === 2 && 'rounded-tr',
              i === 6 && 'rounded-bl',
              i === 8 && 'rounded-br',
            ]"
            :aria-label="cellLabel(i)"
            @click="handleClick(i)"
          >
            <!-- Marks will go here in Task 2 -->
          </button>
        </div>
      </div>
    </div>

    <!-- Status -->
    <div class="text-center mt-6 reveal reveal-d5" aria-live="polite">
      <p class="font-display text-lg tracking-wide text-ink-muted">
        {{ statusText }}
      </p>
    </div>

    <!-- Reset -->
    <div class="text-center mt-4 reveal reveal-d6">
      <button
        class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent hover:text-accent-light transition-colors accent-hover"
        @click="resetGame"
      >
        New Game
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add script setup with state and mode selector logic**

Add to the same file:

```vue
<script setup>
useHead({
  title: 'Tic Tac Toe',
  meta: [{ name: 'description', content: 'Play Tic Tac Toe — classic and vanishing modes, local or vs computer.' }],
})

const modes = [
  { label: 'Classic', value: 'classic' },
  { label: 'Classic vs AI', value: 'classic-vs-computer' },
  { label: 'Vanishing', value: 'vanishing' },
  { label: 'Vanishing vs AI', value: 'vanishing-vs-computer' },
]

const gameMode = ref('classic')
const board = ref(Array(9).fill(null))
const currentPlayer = ref('X')
const winner = ref(null)
const winningCells = ref([])
const moveHistory = ref({ X: [], O: [] })

const isVanishing = computed(() => gameMode.value.startsWith('vanishing'))
const isComputer = computed(() => gameMode.value.endsWith('-vs-computer'))

const statusText = computed(() => {
  if (winner.value === 'draw') return "It's a draw!"
  if (winner.value) return `${winner.value} wins!`
  return `${currentPlayer.value}'s turn`
})

function cellLabel(i) {
  const row = Math.floor(i / 3) + 1
  const col = (i % 3) + 1
  const mark = board.value[i]
  return `Row ${row}, Column ${col}${mark ? ': ' + mark : ': empty'}`
}

function setMode(mode) {
  gameMode.value = mode
  resetGame()
}

function resetGame() {
  board.value = Array(9).fill(null)
  currentPlayer.value = 'X'
  winner.value = null
  winningCells.value = []
  moveHistory.value = { X: [], O: [] }
}

function handleClick(i) {
  // Placeholder — filled in Task 3
}
</script>
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Open: `http://localhost:3000/tic-tac-toe`
Expected: Page shows header, mode buttons (Classic active), empty 3x3 dark grid in a card, status "X's turn", and "New Game" button. Mode buttons switch active state. Clicking cells does nothing yet.

- [ ] **Step 4: Commit**

```bash
git add app/pages/tic-tac-toe.vue
git commit -m "feat: scaffold tic-tac-toe page with header, mode selector, and empty board"
```

---

### Task 2: X and O mark rendering with glow effects and animations

**Files:**
- Modify: `app/pages/tic-tac-toe.vue`

- [ ] **Step 1: Add mark components inside the cell button**

Replace the `<!-- Marks will go here in Task 2 -->` comment with:

```vue
<!-- X mark -->
<div
  v-if="cell === 'X'"
  class="mark mark-x"
  :class="{
    'mark-win': winningCells.includes(i),
    'mark-dim': winner && !winningCells.includes(i),
    'mark-fading': fadingCell === i,
  }"
>
  <div class="x-bar x-bar-1" />
  <div class="x-bar x-bar-2" />
</div>
<!-- O mark -->
<div
  v-if="cell === 'O'"
  class="mark mark-o"
  :class="{
    'mark-win': winningCells.includes(i),
    'mark-dim': winner && !winningCells.includes(i),
    'mark-fading': fadingCell === i,
  }"
/>
```

- [ ] **Step 2: Add fadingCell computed property**

Add to `<script setup>` after the other computed properties:

```js
const fadingCell = computed(() => {
  if (!isVanishing.value) return null
  const history = moveHistory.value[currentPlayer.value]
  if (history.length >= 3) return history[0]
  return null
})
```

- [ ] **Step 3: Add scoped styles for marks, glow, and animations**

Add `<style scoped>` block:

```vue
<style scoped>
/* Mark base */
.mark {
  width: 50%;
  height: 50%;
  position: relative;
  animation: mark-appear 0.2s ease-out;
}

@keyframes mark-appear {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* X mark — two rotated bars */
.mark-x {
  width: 45%;
  height: 45%;
}

.x-bar {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 4px;
  background: #f59e0b;
  border-radius: 2px;
  box-shadow: 0 0 12px #f59e0b, 0 0 28px rgba(245, 158, 11, 0.4);
}

.x-bar-1 {
  transform: translate(-50%, -50%) rotate(45deg);
}

.x-bar-2 {
  transform: translate(-50%, -50%) rotate(-45deg);
}

/* O mark — glowing circle */
.mark-o {
  width: 40%;
  height: 40%;
  border: 4px solid #22d3ee;
  border-radius: 50%;
  box-shadow: 0 0 12px #22d3ee, 0 0 24px rgba(34, 211, 238, 0.4), inset 0 0 8px rgba(34, 211, 238, 0.3);
}

/* Win glow pulse */
.mark-win {
  animation: glow-pulse 1s ease-in-out infinite alternate;
}

.mark-x.mark-win .x-bar {
  box-shadow: 0 0 20px #f59e0b, 0 0 40px rgba(245, 158, 11, 0.6);
}

.mark-o.mark-win {
  box-shadow: 0 0 20px #22d3ee, 0 0 40px rgba(34, 211, 238, 0.6), inset 0 0 12px rgba(34, 211, 238, 0.4);
}

@keyframes glow-pulse {
  from { filter: brightness(1); }
  to { filter: brightness(1.4); }
}

/* Dim non-winning marks */
.mark-dim {
  opacity: 0.3;
}

/* Fading mark in vanishing mode */
.mark-fading {
  opacity: 0.35;
  animation: fade-pulse 1.5s ease-in-out infinite alternate;
}

@keyframes fade-pulse {
  from { opacity: 0.25; }
  to { opacity: 0.45; }
}
</style>
```

- [ ] **Step 4: Verify in browser**

Temporarily modify `board` default to have some test marks: `['X', 'O', null, null, 'X', null, 'O', null, null]`. Open page. Expected: Glowing orange X's and cyan O's visible, scaled in with animation. Revert test data after confirming.

- [ ] **Step 5: Commit**

```bash
git add app/pages/tic-tac-toe.vue
git commit -m "feat: add X and O mark rendering with neon glow effects"
```

---

### Task 3: Classic mode game logic (local 2-player)

**Files:**
- Modify: `app/pages/tic-tac-toe.vue`

- [ ] **Step 1: Add win detection and game logic functions**

Add to `<script setup>`:

```js
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
]

function checkWinner() {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line
    if (board.value[a] && board.value[a] === board.value[b] && board.value[a] === board.value[c]) {
      winner.value = board.value[a]
      winningCells.value = line
      return true
    }
  }
  if (!isVanishing.value && board.value.every(cell => cell !== null)) {
    winner.value = 'draw'
    return true
  }
  return false
}
```

- [ ] **Step 2: Implement handleClick for classic local mode**

Replace the placeholder `handleClick`:

```js
const aiThinking = ref(false)

function handleClick(i) {
  if (winner.value) return
  if (aiThinking.value) return
  // Allow clicking on fading cell — it will be vacated during makeMove
  if (board.value[i] !== null && fadingCell.value !== i) return

  makeMove(i)
}

function makeMove(i) {
  const player = currentPlayer.value

  // Vanishing removal
  if (isVanishing.value && moveHistory.value[player].length >= 3) {
    const oldest = moveHistory.value[player].shift()
    board.value[oldest] = null
  }

  // Place mark
  board.value[i] = player
  moveHistory.value[player].push(i)

  // Check for win/draw
  if (checkWinner()) return

  // Switch turn
  currentPlayer.value = player === 'X' ? 'O' : 'X'

  // Trigger AI if needed
  if (isComputer.value && currentPlayer.value === 'O') {
    aiThinking.value = true
    setTimeout(() => {
      const move = getAiMove()
      if (move !== null) makeMove(move)
      aiThinking.value = false
    }, 400)
  }
}

function getAiMove() {
  // Placeholder — filled in Task 4
  return null
}
```

- [ ] **Step 3: Add cursor styles to cells**

Update the cell button classes to include cursor logic. Add these to the cell `<button>` `:class` array:

```
!winner && !aiThinking && (board[i] === null || fadingCell === i) ? 'cursor-pointer hover:bg-[#111]' : 'cursor-default',
```

- [ ] **Step 4: Verify in browser**

Open page. Click cells to place X and O alternately. Confirm:
- X always goes first
- Can't click occupied cells
- Wins are detected (status shows "X wins!" or "O wins!")
- Winning cells glow brighter, others dim
- Draw shows "It's a draw!"
- "New Game" resets everything
- Mode switching resets the board

- [ ] **Step 5: Commit**

```bash
git add app/pages/tic-tac-toe.vue
git commit -m "feat: add classic mode game logic with win/draw detection"
```

---

### Task 4: AI opponent logic

**Files:**
- Modify: `app/pages/tic-tac-toe.vue`

- [ ] **Step 1: Implement getAiMove for classic mode**

Replace the placeholder `getAiMove`:

```js
function getAiMove() {
  const b = [...board.value]
  const player = currentPlayer.value
  const opponent = player === 'X' ? 'O' : 'X'

  // In vanishing mode, simulate removal before evaluating
  if (isVanishing.value && moveHistory.value[player].length >= 3) {
    const oldest = moveHistory.value[player][0]
    b[oldest] = null
  }

  const emptyCells = b.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1)

  // 1. Win: can AI win this turn?
  for (const i of emptyCells) {
    b[i] = player
    if (checkBoard(b, player)) { return i }
    b[i] = null
  }

  // 2. Block: can opponent win next turn?
  for (const i of emptyCells) {
    const simB = [...b]
    // Simulate opponent's vanishing removal
    if (isVanishing.value && moveHistory.value[opponent].length >= 3) {
      simB[moveHistory.value[opponent][0]] = null
    }
    simB[i] = opponent
    if (checkBoard(simB, opponent)) { return i }
  }

  // 3. Center
  if (emptyCells.includes(4)) return 4

  // 4. Corners
  const corners = [0, 2, 6, 8].filter(i => emptyCells.includes(i))
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)]

  // 5. Any
  return emptyCells[Math.floor(Math.random() * emptyCells.length)] ?? null
}

function checkBoard(b, player) {
  return WINNING_LINES.some(([a, b2, c]) => b[a] === player && b[b2] === player && b[c] === player)
}
```

- [ ] **Step 2: Verify in browser**

Switch to "Classic vs AI" mode. Play several games:
- AI responds after ~400ms delay
- AI blocks your winning moves
- AI takes wins when available
- AI prefers center, then corners
- Board is non-interactive during AI turn

- [ ] **Step 3: Commit**

```bash
git add app/pages/tic-tac-toe.vue
git commit -m "feat: add AI opponent with win/block/center/corner priority"
```

---

### Task 5: Vanishing mode logic and visuals

**Files:**
- Modify: `app/pages/tic-tac-toe.vue`

- [ ] **Step 1: Verify vanishing logic already works**

The `makeMove` function already handles vanishing removal (added in Task 3). The `fadingCell` computed (added in Task 2) drives the visual. Switch to "Vanishing" mode and verify:
- After a player has 3 marks, their oldest shows fading animation
- Placing a 4th removes the oldest and places the new one
- Can't click on the fading cell
- After removal, the vacated cell becomes available
- Game continues until someone wins (no draws)

- [ ] **Step 2: Verify vanishing vs computer**

Switch to "Vanishing vs AI". Verify:
- AI correctly simulates removal before choosing moves
- AI doesn't pointlessly block lines that will break when opponent's mark vanishes
- Game plays smoothly with removals and AI delay

- [ ] **Step 3: Fix any issues found during verification**

If any edge cases surface (e.g., AI picking invalid cells, fading cell not updating correctly after mode switch), fix them here.

- [ ] **Step 4: Commit**

```bash
git add app/pages/tic-tac-toe.vue
git commit -m "feat: verify and polish vanishing mode for local and AI play"
```

---

### Task 6: Final polish and responsive tuning

**Files:**
- Modify: `app/pages/tic-tac-toe.vue`

- [ ] **Step 1: Test on mobile viewport**

In browser dev tools, switch to mobile viewport (375px wide). Verify:
- Board fits without horizontal scroll
- Cells are large enough to tap (~80px minimum)
- Mode buttons wrap neatly
- Status and reset button are readable and tappable

- [ ] **Step 2: Add touch-action to prevent zoom on double-tap**

Add `touch-manipulation` Tailwind class to each cell `<button>` in the board grid.

- [ ] **Step 3: Final visual check**

Compare the board visuals against the GiiKer device reference image:
- Dark cells with white grid lines showing through the gap
- Orange X's with warm neon glow
- Cyan O's with blue neon glow
- Placement animation feels snappy
- Win glow pulse is visible but not distracting
- Fading marks in vanishing mode are clearly dimmer

- [ ] **Step 4: Commit**

```bash
git add app/pages/tic-tac-toe.vue
git commit -m "feat: polish responsive layout and mobile touch handling"
```
