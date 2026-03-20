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
