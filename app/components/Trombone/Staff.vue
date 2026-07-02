<script setup lang="ts">
import type { TromboneNote } from '~/utils/trombone/positions'
import { STAFF, STAFF_LINE_YS, noteY, ledgerYs } from '~/utils/trombone/notation'

const props = defineProps<{ note: TromboneNote }>()

const y = computed(() => noteY(props.note))
const ledgers = computed(() => ledgerYs(props.note))
const accidental = computed(() =>
  props.note.accidental === 'flat' ? '♭' : props.note.accidental === 'sharp' ? '♯' : null,
)
</script>

<template>
  <svg :viewBox="STAFF.viewBox" class="w-full max-w-md mx-auto" role="img" aria-label="Note on a bass-clef staff">
    <!-- Staff lines -->
    <line
      v-for="ly in STAFF_LINE_YS"
      :key="`staff-${ly}`"
      :x1="STAFF.left"
      :x2="STAFF.right"
      :y1="ly"
      :y2="ly"
      class="stroke-ink-faint"
      stroke-width="1.5"
    />
    <!-- Bass clef: curl starting on the F line, plus the two dots -->
    <path
      d="M 34 68
         C 27 64 24 57 26 51
         C 28 45 35 42 43 42
         C 54 42 61 49 61 59
         C 61 78 45 95 26 106
         C 43 93 53 78 53 60
         C 53 51 49 46 43 46
         C 37 46 33 50 33 55
         C 34 53 37 51 40 51
         C 45 51 48 55 48 60
         C 48 65 44 69 39 69
         C 37 69 35 69 34 68
         Z"
      class="fill-ink"
    />
    <circle cx="72" cy="56" r="3.2" class="fill-ink" />
    <circle cx="72" cy="72" r="3.2" class="fill-ink" />
    <!-- Ledger lines -->
    <line
      v-for="ly in ledgers"
      :key="`ledger-${ly}`"
      :x1="STAFF.noteX - STAFF.ledgerHalfWidth"
      :x2="STAFF.noteX + STAFF.ledgerHalfWidth"
      :y1="ly"
      :y2="ly"
      class="stroke-ink-faint"
      stroke-width="1.5"
    />
    <!-- Accidental -->
    <text
      v-if="accidental"
      :x="STAFF.noteX - 26"
      :y="y + 7"
      class="fill-ink font-body"
      font-size="24"
    >{{ accidental }}</text>
    <!-- Notehead -->
    <ellipse
      :cx="STAFF.noteX"
      :cy="y"
      rx="7.5"
      ry="5.5"
      :transform="`rotate(-18 ${STAFF.noteX} ${y})`"
      class="fill-ink"
    />
  </svg>
</template>
