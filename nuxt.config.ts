export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },
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
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400&display=swap',
        },
      ],
    },
  },
  postcss: {
    plugins: {
      'tailwindcss': {},
      'autoprefixer': {},
    },
  },
})
