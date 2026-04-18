export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },
  modules: [
    'nuxt-security',
    '@vite-pwa/nuxt',
  ],
  css: ['~/assets/sass/main.scss'],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      titleTemplate: '%s — alola.org',
      meta: [
        { name: 'description', content: 'Graeme Lawton — serial volunteer, technical nerd, hobby collector, outdoors lover.' },
        { property: 'og:site_name', content: 'alola.org' },
        { property: 'og:type', content: 'website' },
        { name: 'theme-color', content: '#141210' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  nitro: {
    preset: 'vercel',
  },
  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'manifest-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
      },
      xFrameOptions: 'DENY',
      strictTransportSecurity: {
        maxAge: 63072000,
        includeSubdomains: true,
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      xContentTypeOptions: 'nosniff',
      crossOriginResourcePolicy: 'same-origin',
      crossOriginOpenerPolicy: 'same-origin',
    },
    nonce: true,
    rateLimiter: false,
    requestSizeLimiter: false,
    xssValidator: false,
    corsHandler: false,
  },
  pwa: {
    registerType: 'autoUpdate',
    // InjectManifest: we own the service worker source; Workbox only injects precache.
    strategies: 'injectManifest',
    srcDir: 'public',
    filename: 'service-worker.ts',
    scope: '/todos/',
    // Generate sw only for /todos/ scope; the public site doesn't need a SW.
    workbox: undefined,
    injectManifest: {
      globPatterns: [
        '**/*.{js,css,html,png,svg,ico,webmanifest}',
      ],
      globIgnores: [
        'scrabble/**',  // the scrabble solver has its own assets, not worth precaching here
      ],
    },
    devOptions: {
      enabled: false,  // dev has HMR + own SW lifecycle — keep off to avoid confusion
    },
    // The manifest is served by our Nitro route (see server/api/todos/manifest.webmanifest.get.ts);
    // vite-pwa's bundled manifest is not used.
    manifest: false,
  },
  routeRules: {
    '/api/**': {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  },
  postcss: {
    plugins: {
      'tailwindcss': {},
      'autoprefixer': {},
    },
  },
})
