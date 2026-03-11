<template>
  <footer class="border-t border-ink-faint/30 pt-10 pb-12">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
      <div class="flex items-center gap-5">
        <a
          v-for="social in socials"
          :key="social.label"
          :href="social.href"
          :aria-label="social.label"
          target="_blank"
          rel="noopener noreferrer"
          class="text-ink-muted hover:text-accent transition-colors"
        >
          <span v-html="social.svg" />
        </a>
      </div>
      <div class="font-display text-xs uppercase tracking-widest text-ink-faint">
        Graeme Lawton &middot; {{ new Date().getFullYear() }}
      </div>
    </div>
  </footer>
</template>

<script setup>
const iconClass = 'w-5 h-5 fill-current'

const socials = [
  {
    label: 'Email',
    href: 'mailto:contact@alola.org',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="${iconClass}"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>`,
  },
  {
    label: 'GitHub',
    href: 'https://github.com/grim8634',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="${iconClass}"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/graemelawton/',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="${iconClass}"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  },
  {
    label: 'Bluesky',
    href: 'https://bsky.app/profile/glawton.bsky.social',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="${iconClass}"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364q.204-.03.415-.056-.207.033-.415.056c-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a9 9 0 01-.415-.056q.21.026.415.056c2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8"/></svg>`,
  },
]
</script>
