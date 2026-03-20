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
            class="aspect-square bg-[#0a0a0a] flex items-center justify-center touch-manipulation"
            :class="[
              i === 0 && 'rounded-tl',
              i === 2 && 'rounded-tr',
              i === 6 && 'rounded-bl',
              i === 8 && 'rounded-br',
              !winner && !aiThinking && (board[i] === null || fadingCell === i) ? 'cursor-pointer hover:bg-[#111]' : 'cursor-default',
            ]"
            :aria-label="cellLabel(i)"
            @click="handleClick(i)"
          >
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

const fadingCell = computed(() => {
  if (!isVanishing.value) return null
  const history = moveHistory.value[currentPlayer.value]
  if (history.length >= 3) return history[0]
  return null
})

function cellLabel(i) {
  const row = Math.floor(i / 3) + 1
  const col = (i % 3) + 1
  const mark = board.value[i]
  const fading = fadingCell.value === i ? ' (fading)' : ''
  return `Row ${row}, Column ${col}${mark ? ': ' + mark + fading : ': empty'}`
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

const aiThinking = ref(false)
let aiTimer = null
onBeforeUnmount(() => { clearTimeout(aiTimer) })

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
    aiTimer = setTimeout(() => {
      const move = getAiMove()
      if (move !== null) makeMove(move)
      aiThinking.value = false
    }, 400)
  }
}

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
</script>

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
