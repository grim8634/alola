<template>
  <div>
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Projects
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Things I work on — volunteering, tech, and gaming projects.
      </h1>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <div class="divide-y divide-ink-faint/10">
      <div
        v-for="(project, i) in projects"
        :key="project.title"
        class="py-10 sm:py-12 reveal"
        :class="'reveal-d' + (i + 2)"
      >
        <div class="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-12">
          <span class="font-display text-6xl sm:text-7xl font-extrabold text-ink-faint/20 leading-none select-none shrink-0">
            {{ String(i + 1).padStart(2, '0') }}
          </span>
          <div>
            <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {{ project.title }}
            </h2>
            <p class="font-body text-ink-muted mt-3 leading-relaxed max-w-lg">
              {{ project.description }}
            </p>
            <div class="flex items-center gap-4 mt-4">
              <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                {{ project.tag }}
              </span>
              <a
                v-if="project.url"
                :href="project.url"
                target="_blank"
                rel="noopener noreferrer"
                class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint hover:text-accent transition-colors accent-hover"
              >
                Visit &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'Projects',
  meta: [{ name: 'description', content: 'Things Graeme Lawton has built — volunteering, tech, and gaming projects.' }],
})

const projects = [
  {
    title: '1st Hazel Grove Scouts',
    description: 'Helping young people develop skills for life through adventure, the outdoors, and getting stuck in with the community.',
    tag: 'Volunteering',
    url: 'https://1hg.org/',
  },
  {
    title: 'Bedding Plants',
    description: 'Online ordering site for the Scouts annual bedding plant fundraiser — making it easy for supporters to get their gardens sorted.',
    tag: 'Scouts / Tech',
    url: 'https://plants.1hg.org/',
  },
  {
    title: 'NPSI Rocks',
    description: 'The central hub for public EVE Online fleets — helping players find NPSI content, connect with fleet commanders, and get into the action.',
    tag: 'Gaming / Tech',
    url: 'https://npsi.rocks/',
  },
]
</script>
