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
        Head of Technology. Mountain rescuer. Scout leader. Trombonist. Diver.
      </p>
    </div>

    <!-- roles strip -->
    <div class="flex flex-wrap gap-3 pb-12 reveal reveal-d3">
      <span
        v-for="role in roles"
        :key="role.label"
        class="inline-flex items-center gap-2 px-4 py-2 border border-ink-faint/20 rounded-full text-sm transition-colors hover:border-accent/40 group"
      >
        <span class="font-display text-xs font-semibold uppercase tracking-widest text-accent">{{ role.tag }}</span>
        <span class="text-ink-faint">·</span>
        <span class="font-body text-ink-muted group-hover:text-ink transition-colors">{{ role.label }}</span>
      </span>
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

    <!-- featured project -->
    <div class="py-12 reveal reveal-d5">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-6">
        Featured project
      </span>
      <NuxtLink
        to="/projects"
        class="group block bg-surface-raised border border-ink-faint/10 rounded-lg p-6 sm:p-8 transition-colors hover:border-accent/30"
      >
        <h2 class="font-display text-xl sm:text-2xl font-bold tracking-tight group-hover:text-accent transition-colors">
          {{ featured.title }}
        </h2>
        <p class="font-body text-ink-muted mt-3 leading-relaxed max-w-lg">
          {{ featured.description }}
        </p>
        <div class="flex items-center gap-4 mt-4">
          <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
            {{ featured.tag }}
          </span>
          <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint group-hover:text-accent transition-colors accent-hover">
            View projects &rarr;
          </span>
        </div>
      </NuxtLink>
    </div>

    <!-- latest rambling -->
    <div class="border-t border-ink-faint/20 py-12 reveal reveal-d6">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-6">
        Latest rambling
      </span>
      <NuxtLink
        :to="'/ramblings/' + latestPost.slug"
        class="group block"
      >
        <div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8">
          <span class="font-body text-sm text-ink-faint shrink-0 sm:w-28">
            {{ latestPost.date }}
          </span>
          <div>
            <h2 class="font-display text-xl sm:text-2xl font-bold tracking-tight group-hover:text-accent transition-colors">
              {{ latestPost.title }}
            </h2>
            <p class="font-body text-ink-muted mt-2 leading-relaxed max-w-lg">
              {{ latestPost.excerpt }}
            </p>
            <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint group-hover:text-accent transition-colors mt-3 inline-block accent-hover">
              Read &rarr;
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Graeme Lawton' })

const roles = [
  { tag: 'Work', label: 'Cartridge Save' },
  { tag: 'Rescue', label: 'Kinder MRT' },
  { tag: 'Scouts', label: '1st Hazel Grove' },
  { tag: 'Music', label: 'New Mills Brass Band' },
  { tag: 'Diving', label: 'Scuba' },
]

const sections = [
  { to: '/about', label: 'About', desc: 'Who I am and what drives me.' },
  { to: '/projects', label: 'Projects', desc: 'Things I build and help run.' },
  { to: '/ramblings', label: 'Ramblings', desc: 'Thoughts, notes, and whatever else.' },
]

const featured = {
  title: '1st Hazel Grove Scouts',
  description: 'Helping young people develop skills for life through adventure, the outdoors, and getting stuck in with the community.',
  tag: 'Volunteering',
}

const latestPost = {
  slug: 'ai-tooling-and-the-closing-window',
  title: 'AI tooling and the closing window',
  date: '11 March 2026',
  excerpt: 'We\'re in a unique moment for software development. Simple projects take minutes, complex migrations take weeks instead of months, and the window where human oversight is essential is visibly narrowing.',
}
</script>
