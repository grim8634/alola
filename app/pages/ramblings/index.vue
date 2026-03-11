<template>
  <div>
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        Ramblings
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        Thoughts &amp; notes
      </h1>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <div class="divide-y divide-ink-faint/10">
      <NuxtLink
        v-for="(post, i) in posts"
        :key="post.slug"
        :to="'/ramblings/' + post.slug"
        class="block py-10 sm:py-12 group reveal"
        :class="'reveal-d' + (i + 2)"
      >
        <div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-12">
          <span class="font-body text-sm text-ink-faint shrink-0 sm:w-28">
            {{ post.date }}
          </span>
          <div>
            <h2 class="font-display text-xl sm:text-2xl font-bold tracking-tight group-hover:text-accent transition-colors">
              {{ post.title }}
            </h2>
            <p class="font-body text-ink-muted mt-2 leading-relaxed max-w-lg">
              {{ post.excerpt }}
            </p>
            <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint group-hover:text-accent transition-colors mt-3 inline-block">
              Read &rarr;
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
const posts = [
  {
    slug: 'ai-tooling-and-the-closing-window',
    title: 'AI tooling and the closing window',
    date: '11 March 2026',
    excerpt: 'We\'re in a unique moment for software development. Simple projects take minutes, complex migrations take weeks instead of months, and the window where human oversight is essential is visibly narrowing.',
  },
]
</script>
