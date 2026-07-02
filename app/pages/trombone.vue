<script setup lang="ts">
import { createQuiz, type Question } from '~/utils/trombone/quiz'

useHead({
  title: 'Trombone Trainer',
  meta: [
    {
      name: 'description',
      content: 'Practice reading concert-pitch bass clef on tenor trombone: name notes on the staff and pick their slide positions.',
    },
  ],
})

const quiz = createQuiz()
const question = ref<Question>(quiz.next())
const selected = ref<string | null>(null)
const isCorrect = ref(false)
const correct = ref(0)
const total = ref(0)
const streak = ref(0)

const prompt = computed(() =>
  question.value.mode === 'name' ? 'Name this note' : 'Which slide position?',
)

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th']
const answerText = computed(() => {
  const n = question.value.note
  return `${n.display} — ${ORDINALS[n.position]} position`
})

function answer(choice: string) {
  if (selected.value !== null) return
  selected.value = choice
  isCorrect.value = quiz.submit(question.value, choice)
  total.value++
  if (isCorrect.value) {
    correct.value++
    streak.value++
  } else {
    streak.value = 0
  }
}

function nextQuestion() {
  selected.value = null
  question.value = quiz.next()
}

function buttonClass(choice: string) {
  if (selected.value === null)
    return 'text-ink-muted hover:text-ink border border-ink-faint/20 hover:border-accent/50 cursor-pointer'
  if (choice === question.value.answer) return 'bg-accent text-surface'
  if (choice === selected.value) return 'text-red-400 border border-red-400/40'
  return 'text-ink-faint border border-ink-faint/10'
}
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

    <!-- Score row -->
    <div class="flex gap-6 pt-8 pb-6 font-display text-xs font-semibold uppercase tracking-[0.2em] reveal reveal-d3">
      <span class="text-ink-muted">Score <span class="text-ink">{{ correct }}/{{ total }}</span></span>
      <span class="text-ink-muted">Streak <span class="text-accent">{{ streak }}</span></span>
    </div>

    <!-- Quiz card -->
    <!-- ClientOnly: the question is picked with Math.random() at setup time, so
         server and client would otherwise render different questions and Vue
         would report a hydration mismatch. -->
    <div class="pb-16 reveal reveal-d4">
      <ClientOnly>
      <div class="bg-surface-raised border border-ink-faint/10 rounded-lg p-6 max-w-xl mx-auto">
        <TromboneStaff :note="question.note" />

        <p class="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted text-center mt-6 mb-4">
          {{ prompt }}
        </p>

        <!-- Answer buttons -->
        <div
          class="grid gap-2"
          :class="question.mode === 'name' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-4 sm:grid-cols-7'"
        >
          <button
            v-for="choice in question.choices"
            :key="choice"
            class="font-display text-sm font-semibold px-3 py-3 rounded-md transition-colors touch-manipulation"
            :class="buttonClass(choice)"
            @click="answer(choice)"
          >
            {{ choice }}
          </button>
        </div>

        <!-- Feedback -->
        <div v-if="selected !== null" class="mt-6 text-center">
          <p class="font-display font-semibold" :class="isCorrect ? 'text-accent' : 'text-red-400'">
            {{ isCorrect ? 'Correct!' : 'Not quite' }}
          </p>
          <p class="font-body text-ink-muted mt-1">{{ answerText }}</p>
          <TromboneSlide :highlight="question.note.position" class="mt-4" />
          <button
            class="font-display text-xs font-semibold uppercase tracking-[0.2em] px-6 py-3 mt-4 rounded-md bg-accent text-surface hover:bg-accent-light transition-colors touch-manipulation"
            @click="nextQuestion"
          >
            Next
          </button>
        </div>
      </div>
      </ClientOnly>
    </div>
  </div>
</template>
