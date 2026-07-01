<template>
  <div>
    <!-- Header -->
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Tool
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Scrabble Solver
      </h1>
      <p class="font-body text-ink-muted mt-4 max-w-lg reveal reveal-d2">
        Upload a screenshot from the Scopely Scrabble app, review the detected board, and find the best moves.
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <!-- Upload area -->
    <div v-if="!boardLoaded" class="pt-8 reveal reveal-d3">
      <div
        class="border-2 border-dashed border-ink-faint/30 rounded-lg p-12 text-center cursor-pointer hover:border-accent/50 transition-colors"
        @click="triggerUpload"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
        :class="{ 'border-accent/50 bg-accent/5': dragOver }"
      >
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFileSelect"
        />
        <p class="font-display text-lg text-ink-muted mb-2">
          Drop a screenshot here or click to upload
        </p>
        <p class="font-body text-sm text-ink-faint">
          Supports PNG, JPG. You can also paste from clipboard (Ctrl+V).
        </p>
      </div>

      <div class="text-center mt-6">
        <button
          class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent hover:text-accent-light transition-colors accent-hover"
          @click="loadDemo"
        >
          Load Demo Board
        </button>
      </div>
    </div>

    <!-- Parsing state -->
    <div v-if="parsing" class="pt-8 text-center reveal reveal-d3">
      <div class="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p class="font-body text-ink-muted mt-3">Parsing screenshot...</p>
    </div>

    <!-- Error display -->
    <div v-if="errorMessage" class="pt-8 reveal reveal-d3">
      <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
        <p class="font-body text-red-400 text-sm">{{ errorMessage }}</p>
      </div>
    </div>

    <!-- Board + Results -->
    <div v-if="boardLoaded && !parsing" class="pt-8 reveal reveal-d3">
      <!-- Board grid -->
      <div class="flex justify-center">
        <div class="w-full max-w-[min(100vw-2rem,480px)]">
          <div
            class="grid gap-[1px] bg-ink-faint/20 rounded"
            :style="{ gridTemplateColumns: 'repeat(15, 1fr)' }"
          >
            <template v-for="row in BOARD_SIZE" :key="'row-' + row">
              <div
                v-for="col in BOARD_SIZE"
                :key="'cell-' + (row - 1) + '-' + (col - 1)"
                role="button"
                tabindex="0"
                :aria-label="'Row ' + row + ', column ' + col + (boardState.cells[row - 1][col - 1].letter ? ', letter ' + boardState.cells[row - 1][col - 1].letter : ', empty')"
                class="aspect-square flex items-center justify-center text-[10px] sm:text-xs font-display font-bold relative select-none"
                :class="cellClasses(row - 1, col - 1)"
                :style="cellStyle(row - 1, col - 1)"
                @click="editCell(row - 1, col - 1)"
                @keydown.enter.prevent="editCell(row - 1, col - 1)"
              >
                <!-- Editing input -->
                <input
                  v-if="editingRow === row - 1 && editingCol === col - 1"
                  ref="cellInputRef"
                  type="text"
                  maxlength="1"
                  :aria-label="'Edit letter at row ' + row + ', column ' + col"
                  class="absolute inset-0 w-full h-full text-center text-[10px] sm:text-xs font-display font-bold bg-surface border-2 border-accent outline-none uppercase z-10"
                  :value="boardState.cells[row - 1][col - 1].letter || ''"
                  @input="onCellInput($event, row - 1, col - 1)"
                  @blur="onEditBlur"
                  @keydown.enter.prevent="advanceEdit"
                  @keydown.tab.prevent="advanceEdit"
                  @keydown.escape="finishQuickEdit"
                  @keydown.backspace="onEditBackspace($event, row - 1, col - 1)"
                />
                <!-- Highlighted move letter -->
                <template v-else-if="isHighlightedPosition(row - 1, col - 1)">
                  <span class="text-surface font-extrabold">{{ getHighlightedLetter(row - 1, col - 1) }}</span>
                </template>
                <!-- Existing tile -->
                <template v-else-if="boardState.cells[row - 1][col - 1].letter">
                  <span>{{ boardState.cells[row - 1][col - 1].letter }}</span>
                </template>
                <!-- Bonus label -->
                <template v-else-if="BONUS_MAP[row - 1][col - 1]">
                  <span class="text-[7px] sm:text-[9px] font-semibold opacity-80">{{ BONUS_MAP[row - 1][col - 1] }}</span>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Rack -->
      <div class="flex justify-center mt-6">
        <div class="flex gap-1 items-center">
          <template v-if="editingRack">
            <input
              ref="rackInputRef"
              type="text"
              maxlength="7"
              aria-label="Edit rack tiles"
              class="w-48 sm:w-56 px-3 py-2 rounded bg-surface border border-accent text-ink font-display font-bold text-center text-lg uppercase tracking-widest outline-none"
              :value="boardState.rack.join('')"
              placeholder="e.g. USENEO?"
              @input="onRackInput"
              @keydown.enter="editingRack = false"
              @keydown.escape="editingRack = false"
              @blur="editingRack = false"
            />
          </template>
          <template v-else>
            <button
              v-for="(tile, i) in rackDisplay"
              :key="'rack-' + i"
              :aria-label="tile ? 'Rack tile ' + tile + ', tap to edit' : 'Empty rack slot, tap to add tiles'"
              class="w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center font-display font-bold text-sm sm:text-base transition-colors"
              :class="tile ? 'bg-surface-subtle text-ink hover:bg-surface-raised' : 'bg-surface-raised/50 text-ink-faint border border-dashed border-ink-faint/30 hover:border-accent/50'"
              @click="startRackEdit"
            >
              {{ tile || '+' }}
            </button>
          </template>
        </div>
      </div>

      <!-- Quick edit progress -->
      <div v-if="quickEditMode" class="text-center mt-4">
        <p class="font-body text-ink-muted text-sm">
          Editing tile {{ quickEditIndex + 1 }} of {{ tileCells.length }} — type a letter, Enter/Tab to advance, Esc to finish
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap justify-center gap-4 mt-6">
        <button
          v-if="!quickEditMode"
          class="font-display text-xs font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-md bg-accent text-surface hover:bg-accent-light transition-colors"
          @click="startQuickEdit"
        >
          Quick Edit Tiles
        </button>
        <button
          v-if="hasChanges && !quickEditMode"
          class="font-display text-xs font-semibold uppercase tracking-[0.2em] px-4 py-2 rounded-md bg-accent text-surface hover:bg-accent-light transition-colors"
          @click="solve"
          :disabled="solving"
        >
          Re-solve
        </button>
        <button
          class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent hover:text-accent-light transition-colors accent-hover"
          @click="reset"
        >
          New Screenshot
        </button>
      </div>

      <!-- Solving spinner -->
      <div v-if="solving" class="text-center mt-6">
        <div class="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p class="font-body text-ink-muted mt-2 text-sm">Finding best moves...</p>
      </div>

      <!-- Results -->
      <div v-if="!solving && moves.length > 0" class="mt-8">
        <h2 class="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted mb-4">
          Top Moves
          <span class="text-ink-faint font-normal normal-case tracking-normal ml-2">
            ({{ moves.length }} found in {{ elapsed }}ms)
          </span>
        </h2>
        <div class="space-y-1">
          <button
            v-for="(move, i) in topMoves"
            :key="'move-' + i"
            class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-3"
            :class="selectedMoveIndex === i ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-raised border border-transparent'"
            @click="selectMove(i)"
          >
            <span class="font-display text-lg font-extrabold text-accent w-12 text-right">{{ move.score }}</span>
            <span class="font-display font-bold text-ink uppercase tracking-wide">{{ move.word }}</span>
            <span class="font-body text-xs text-ink-faint ml-auto">
              {{ move.direction }} at ({{ move.row + 1 }}, {{ move.col + 1 }})
            </span>
          </button>
        </div>
      </div>

      <!-- No moves found -->
      <div v-if="!solving && solveAttempted && moves.length === 0" class="text-center mt-8">
        <p class="font-body text-ink-muted">No valid moves found. Check the board and rack, then try again.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  BOARD_SIZE,
  BONUS_MAP,
  BONUS_COLORS,
  createEmptyBoard,
  type BoardState,
  type Move,
} from '~/utils/scrabble/board'
import { parseScreenshot } from '~/utils/scrabble/parser'

useHead({
  title: 'Scrabble Solver',
  meta: [{ name: 'description', content: 'Upload a Scrabble screenshot and find the best moves.' }],
})

// State
const boardState = ref<BoardState>(createEmptyBoard())
const confidence = ref<number[][]>([])
const boardLoaded = ref(false)
const parsing = ref(false)
const solving = ref(false)
const solveAttempted = ref(false)
const hasChanges = ref(false)
const errorMessage = ref<string | null>(null)
const moves = ref<Move[]>([])
const elapsed = ref(0)
const selectedMoveIndex = ref<number | null>(null)
const dragOver = ref(false)
const editingRow = ref<number | null>(null)
const editingCol = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cellInputRef = ref<HTMLInputElement | null>(null)
const workerReady = ref(false)

// Worker
let worker: Worker | null = null

onMounted(() => {
  worker = new Worker(
    new URL('~/utils/scrabble/solver.worker.ts', import.meta.url),
    { type: 'module' },
  )
  worker.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data
    if (type === 'ready') {
      workerReady.value = true
    } else if (type === 'result') {
      moves.value = payload.moves
      elapsed.value = payload.elapsed
      solving.value = false
      solveAttempted.value = true
      hasChanges.value = false
    } else if (type === 'error') {
      errorMessage.value = payload
      solving.value = false
    }
  }
  worker.postMessage({ type: 'init' })

  document.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  worker?.terminate()
  worker = null
  document.removeEventListener('paste', onPaste)
})

// Computed
const rackDisplay = computed(() => {
  const tiles = [...boardState.value.rack]
  while (tiles.length < 7) tiles.push('')
  return tiles.slice(0, 7)
})

const topMoves = computed(() => moves.value.slice(0, 10))

// File handling
function triggerUpload() {
  fileInput.value?.click()
}

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) processFile(file)
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) processFile(file)
}

function onPaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) processFile(file)
      break
    }
  }
}

async function processFile(file: File) {
  parsing.value = true
  errorMessage.value = null
  boardLoaded.value = false
  moves.value = []
  selectedMoveIndex.value = null
  solveAttempted.value = false

  const result = await parseScreenshot(file)
  parsing.value = false

  if (result.error) {
    errorMessage.value = result.error
    return
  }

  boardState.value = result.board
  confidence.value = result.confidence
  boardLoaded.value = true
  hasChanges.value = false

  solve()
}

// Solver
function solve() {
  if (!worker || !workerReady.value) {
    errorMessage.value = 'Dictionary is still loading. Please wait a moment and try again.'
    return
  }

  solving.value = true
  selectedMoveIndex.value = null
  moves.value = []
  errorMessage.value = null

  worker.postMessage({
    type: 'solve',
    payload: toRaw(boardState.value),
  })
}

// Cell styling
function cellStyle(row: number, col: number): Record<string, string> {
  if (isHighlightedPosition(row, col)) {
    return { backgroundColor: 'var(--color-accent, #f59e0b)', color: '#000' }
  }
  if (boardState.value.cells[row][col].letter) {
    return {}
  }
  const bonus = BONUS_MAP[row][col]
  if (bonus && BONUS_COLORS[bonus]) {
    return {
      backgroundColor: BONUS_COLORS[bonus].bg,
      color: BONUS_COLORS[bonus].text,
    }
  }
  return {}
}

function cellClasses(row: number, col: number): string {
  const classes: string[] = []
  const cell = boardState.value.cells[row][col]

  if (isHighlightedPosition(row, col)) {
    classes.push('cursor-default')
  } else if (cell.letter) {
    classes.push('bg-surface-subtle', 'text-ink', 'cursor-pointer')
  } else {
    classes.push('bg-surface', 'cursor-pointer')
  }

  if (isLowConfidence(row, col)) {
    classes.push('ring-1', 'ring-accent')
  }

  return classes.join(' ')
}

// Quick edit mode — cycle through all tile cells rapidly
const quickEditMode = ref(false)
const quickEditIndex = ref(0)

// List of cells that have tiles (for quick edit navigation)
const tileCells = computed(() => {
  const cells: { row: number; col: number }[] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (boardState.value.cells[r][c].letter !== null) {
        cells.push({ row: r, col: c })
      }
    }
  }
  return cells
})

function startQuickEdit() {
  if (tileCells.value.length === 0) return
  quickEditMode.value = true
  quickEditIndex.value = 0
  editTileAtIndex(0)
}

function editTileAtIndex(index: number) {
  if (index < 0 || index >= tileCells.value.length) {
    finishQuickEdit()
    return
  }
  quickEditIndex.value = index
  const cell = tileCells.value[index]
  editingRow.value = cell.row
  editingCol.value = cell.col
  nextTick(() => {
    const input = cellInputRef.value
    const el = Array.isArray(input) ? input[0] : input
    if (el) {
      el.focus()
      el.select()
    }
  })
}

function advanceEdit() {
  if (quickEditMode.value) {
    editTileAtIndex(quickEditIndex.value + 1)
  } else {
    closeEdit()
  }
}

function finishQuickEdit() {
  quickEditMode.value = false
  quickEditIndex.value = 0
  editingRow.value = null
  editingCol.value = null
  hasChanges.value = true
}

// Cell editing
function editCell(row: number, col: number) {
  editingRow.value = row
  editingCol.value = col
  nextTick(() => {
    const input = cellInputRef.value
    const el = Array.isArray(input) ? input[0] : input
    el?.focus()
  })
}

function onCellInput(event: Event, row: number, col: number) {
  const input = event.target as HTMLInputElement
  const value = input.value.toUpperCase().replace(/[^A-Z]/g, '')
  boardState.value.cells[row][col] = {
    letter: value || null,
    isBlank: false,
  }
  hasChanges.value = true

  // In quick edit mode, auto-advance after typing a letter
  if (quickEditMode.value && value) {
    nextTick(() => advanceEdit())
  } else if (!quickEditMode.value) {
    closeEdit()
  }
}

function onEditBlur() {
  // Don't close if in quick edit mode (focus is moving between cells)
  if (!quickEditMode.value) {
    closeEdit()
  }
}

function onEditBackspace(event: Event, row: number, col: number) {
  const input = event.target as HTMLInputElement
  if (!input.value) {
    // Empty cell + backspace = clear and go to previous in quick edit
    boardState.value.cells[row][col] = { letter: null, isBlank: false }
    hasChanges.value = true
    if (quickEditMode.value && quickEditIndex.value > 0) {
      event.preventDefault()
      editTileAtIndex(quickEditIndex.value - 1)
    }
  }
}

function closeEdit() {
  editingRow.value = null
  editingCol.value = null
}

// Rack editing
const editingRack = ref(false)
const rackInputRef = ref<HTMLInputElement | null>(null)

function startRackEdit() {
  editingRack.value = true
  nextTick(() => {
    const el = Array.isArray(rackInputRef.value) ? rackInputRef.value[0] : rackInputRef.value
    if (el) {
      el.focus()
      el.select()
    }
  })
}

function onRackInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.toUpperCase().replace(/[^A-Z?]/g, '')
  boardState.value.rack = value.split('').slice(0, 7)
  hasChanges.value = true
}

// Move highlighting
function isHighlightedPosition(row: number, col: number): boolean {
  if (selectedMoveIndex.value === null) return false
  const move = topMoves.value[selectedMoveIndex.value]
  if (!move) return false
  return move.positions.some((p) => p.row === row && p.col === col)
}

function getHighlightedLetter(row: number, col: number): string {
  if (selectedMoveIndex.value === null) return ''
  const move = topMoves.value[selectedMoveIndex.value]
  if (!move) return ''
  const pos = move.positions.find((p) => p.row === row && p.col === col)
  return pos?.letter || ''
}

function selectMove(index: number) {
  selectedMoveIndex.value = selectedMoveIndex.value === index ? null : index
}

// Confidence
function isLowConfidence(row: number, col: number): boolean {
  if (!confidence.value.length) return false
  return (confidence.value[row]?.[col] ?? 1) < 0.7
}

// Demo
function loadDemo() {
  const board = createEmptyBoard()
  const hello = 'HELLO'
  for (let i = 0; i < hello.length; i++) {
    board.cells[7][5 + i] = { letter: hello[i], isBlank: false }
  }
  board.rack = ['S', 'T', 'A', 'R', 'E', 'N', 'I']

  boardState.value = board
  confidence.value = []
  boardLoaded.value = true
  hasChanges.value = false
  errorMessage.value = null
  moves.value = []
  selectedMoveIndex.value = null
  solveAttempted.value = false

  solve()
}

// Reset
function reset() {
  boardState.value = createEmptyBoard()
  confidence.value = []
  boardLoaded.value = false
  parsing.value = false
  solving.value = false
  solveAttempted.value = false
  hasChanges.value = false
  errorMessage.value = null
  moves.value = []
  elapsed.value = 0
  selectedMoveIndex.value = null

  // Reset file input
  if (fileInput.value) fileInput.value.value = ''
}
</script>
