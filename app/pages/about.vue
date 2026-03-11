<template>
  <div>
    <div class="pt-12 sm:pt-20 pb-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-4 reveal">
        About
      </span>
      <h1 class="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight reveal reveal-d1">
        The short version
      </h1>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d2" />

    <div class="py-12 space-y-6 max-w-2xl">
      <p class="font-body text-lg leading-8 text-ink-muted reveal reveal-d2">
        I'm Graeme — based in the UK, always juggling too many interests at once.
        I volunteer with my local Scout group, tinker with code, grow things in the
        garden, and spend as much time outdoors as I can.
      </p>
      <p class="font-body text-lg leading-8 text-ink-muted reveal reveal-d3">
        I believe in showing up, getting stuck in, and making things happen. Whether
        it's building something technical, running activities for young people, or just
        getting my hands dirty — I'm happiest when I'm doing, not watching.
      </p>
    </div>

    <div class="h-px bg-ink-faint/20 rule-reveal reveal-d4" />

    <div class="py-12">
      <span class="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent block mb-8 reveal reveal-d4">
        Get in touch
      </span>
      <div class="space-y-4 reveal reveal-d5">
        <a
          v-for="link in contacts"
          :key="link.label"
          :href="link.href"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener noreferrer' : undefined"
          class="group flex items-center gap-4 py-3 border-b border-ink-faint/10 last:border-0 transition-colors hover:border-accent/40"
        >
          <span class="font-display text-sm font-semibold uppercase tracking-widest text-ink-faint group-hover:text-accent transition-colors w-20">
            {{ link.label }}
          </span>
          <span class="font-body text-ink-muted group-hover:text-ink transition-colors">
            {{ link.display }}
          </span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
const contacts = [
  { label: 'Email', href: 'mailto:contact@alola.org', display: 'contact@alola.org', external: false },
  { label: 'GitHub', href: 'https://github.com/grim8634', display: 'grim8634', external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/graemelawton/', display: 'graemelawton', external: true },
  { label: 'Bluesky', href: 'https://bsky.app/profile/glawton.bsky.social', display: '@glawton', external: true },
]
</script>
