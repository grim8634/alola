<script setup lang="ts">
useHead({
  link: [
    { rel: 'manifest', href: '/api/todos/manifest.webmanifest' },
  ],
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'todos' },
  ],
})
</script>

<template>
  <div class="min-h-screen bg-surface text-ink" style="font-family: 'Inter', system-ui, sans-serif;">
    <div class="grain-light" />
    <main class="relative z-10 mx-auto w-full max-w-2xl px-4 pt-4 pb-24 lg:max-w-6xl lg:px-6 lg:pt-6">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* Grain at ~40% of the public site's opacity. */
.grain-light {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  opacity: 0.015;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px;
}
</style>

<!--
  Unscoped: native <option> elements take their colours from the OS by default,
  which breaks contrast on our dark theme. Force a legible palette everywhere.
-->
<style>
select option {
  background-color: #1e1c18;
  color: #e8e2d6;
}
select option:checked,
select option:hover {
  background-color: #28251f;
}
</style>
