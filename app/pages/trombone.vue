<script setup lang="ts">
import { NOTES } from '~/utils/trombone/positions'

useHead({ title: 'Trombone Trainer — Graeme Lawton' })

const demoNote = NOTES.find(n => n.id === 'Bb2')!
</script>

<template>
  <div>
    <!-- Header -->
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Practice
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Trombone Trainer
      </h1>
      <p class="font-body text-ink-muted mt-4 max-w-lg reveal reveal-d2">
        Learn concert-pitch bass clef on tenor trombone — name the note on the
        staff, or pick its slide position.
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <!-- Demo (replaced by quiz in Task 5) -->
    <div class="pt-8 pb-16 reveal reveal-d3">
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 max-w-xl mx-auto">
        <TromboneStaff :note="demoNote" />
        <TromboneSlide :highlight="demoNote.position" class="mt-6" />
      </div>
    </div>
  </div>
</template>
