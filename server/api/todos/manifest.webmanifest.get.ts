// server/api/todos/manifest.webmanifest.get.ts — scoped PWA manifest.
// Linked only from the app layout so the public marketing site is unaffected.
import { defineEventHandler, setHeader } from 'h3'

const MANIFEST = {
  name: 'alola todos',
  short_name: 'todos',
  scope: '/todos/',
  start_url: '/todos/?utm_source=pwa',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#141210',
  background_color: '#141210',
  icons: [
    { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'New task', short_name: 'New', url: '/todos/?new=1' },
    { name: 'Today',    short_name: 'Today', url: '/todos/' },
    { name: 'Overdue',  short_name: 'Overdue', url: '/todos/?view=overdue' },
  ],
}

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/manifest+json; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return MANIFEST
})
