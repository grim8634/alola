// public/service-worker.ts — custom SW. Workbox injects __WB_MANIFEST at build time.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Precache the app shell (JS/CSS/HTML/fonts/images).
precacheAndRoute((self as any).__WB_MANIFEST ?? [])
cleanupOutdatedCaches()

// Navigation requests to /todos/* — network-first, fall back to cached shell.
registerRoute(
  new NavigationRoute(new NetworkFirst({
    cacheName: 'todos-pages',
    networkTimeoutSeconds: 3,
  }), {
    allowlist: [/^\/todos\//],
  }),
)

// GET /api/tasks and /api/categories — stale-while-revalidate for instant reads.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname === '/api/tasks' || url.pathname === '/api/categories' || url.pathname.startsWith('/api/tasks/')),
  new StaleWhileRevalidate({
    cacheName: 'todos-api',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
)

// Other GET /api/* — network-first with short timeout, no fallback (let it error).
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'todos-api-other', networkTimeoutSeconds: 3 }),
)

// Mutating requests are deliberately NOT intercepted — the main-thread queue owns them.
// We let them hit the network directly; if offline, the fetch rejects and useTasks /
// useCategories enqueue to IndexedDB.

self.addEventListener('install', () => { void (self as any).skipWaiting?.() })
self.addEventListener('activate', (event: any) => { event.waitUntil((self as any).clients.claim()) })
