<template>
  <div class="bg-surface min-h-screen text-ink pl-[calc(100vw-100%)]">
    <div class="grain" />
    <section class="relative z-10 mx-auto max-w-2xl px-6 lg:max-w-4xl lg:px-8">
      <LayoutHeader />
      <main class="pb-24">
        <slot />
      </main>
      <LayoutFooter />
    </section>
  </div>
</template>
