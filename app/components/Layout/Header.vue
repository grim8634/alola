<template>
  <div>
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
          class="font-display text-sm font-semibold uppercase tracking-widest transition-colors accent-hover"
          :class="isActive(link.to) ? 'text-accent' : 'text-ink-muted hover:text-accent'"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <button
        aria-label="Toggle Menu"
        class="sm:hidden text-ink-muted hover:text-accent transition-colors"
        @click="mobileOpen = !mobileOpen"
      >
        <SvgToggleMenu />
      </button>
    </header>

    <!-- Mobile menu -->
    <Transition name="mobile-menu">
      <nav v-if="mobileOpen" class="sm:hidden border-b border-ink-faint/20 pb-6 mb-6 flex flex-col gap-4">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="font-display text-sm font-semibold uppercase tracking-widest transition-colors accent-hover"
          :class="isActive(link.to) ? 'text-accent' : 'text-ink-muted hover:text-accent'"
          @click="mobileOpen = false"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </Transition>
  </div>
</template>

<script setup>
const route = useRoute()
const mobileOpen = ref(false)

const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/projects', label: 'Projects' },
  { to: '/ramblings', label: 'Ramblings' },
]

function isActive(to) {
  return route.path === to || route.path.startsWith(to + '/')
}

watch(() => route.path, () => {
  mobileOpen.value = false
})
</script>
