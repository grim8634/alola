<template>
  <div>
    <!-- hero -->
    <div class="pt-12 sm:pt-20 pb-16">
      <p class="font-body italic text-ink-muted text-lg reveal">Hello, I'm</p>
      <h1 class="font-display text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-none mt-3 reveal reveal-d1">
        Graeme<br />Lawton
      </h1>
      <div class="h-px bg-accent mt-8 mb-8 w-24 rule-reveal reveal-d2" />
      <p class="font-body text-xl sm:text-2xl leading-relaxed text-ink-muted max-w-xl reveal reveal-d3">
        Serial volunteer. Technical nerd. Hobby collector. Outdoors lover.
      </p>
    </div>

    <!-- what I'm about -->
    <div class="grid gap-px sm:grid-cols-3 border-t border-b border-ink-faint/20 reveal reveal-d4">
      <NuxtLink
        v-for="section in sections"
        :key="section.to"
        :to="section.to"
        class="group py-8 sm:px-6 first:sm:pl-0 last:sm:pr-0 border-b sm:border-b-0 sm:border-r border-ink-faint/20 last:border-0 transition-colors hover:bg-surface-raised"
      >
        <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-2">
          {{ section.label }}
        </span>
        <span class="font-body text-sm text-ink-muted group-hover:text-ink transition-colors">
          {{ section.desc }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Graeme Lawton' })

const sections = [
  { to: '/about', label: 'About', desc: 'Who I am and what drives me.' },
  { to: '/projects', label: 'Projects', desc: 'Things I build and help run.' },
  { to: '/ramblings', label: 'Ramblings', desc: 'Thoughts, notes, and whatever else.' },
]
</script>
