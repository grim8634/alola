<template>
  <header class="flex items-center justify-between py-8 sm:py-12">
    <NuxtLink aria-label="alola.org" to="/" class="flex items-center gap-3 group">
      <SvgLogo />
      <span class="hidden sm:block font-display text-lg font-semibold tracking-tight text-ink accent-hover">
        alola
      </span>
    </NuxtLink>

    <nav class="hidden sm:flex items-center gap-8">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="font-display text-sm font-semibold uppercase tracking-widest text-ink-muted transition-colors hover:text-accent accent-hover"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>

    <button aria-label="Toggle Menu" class="sm:hidden text-ink-muted hover:text-accent transition-colors">
      <SvgToggleMenu />
    </button>
  </header>
</template>

<script setup>
const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/projects', label: 'Projects' },
  { to: '/ramblings', label: 'Ramblings' },
]
</script>
