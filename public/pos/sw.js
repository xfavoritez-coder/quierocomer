// POS QuieroComer — Service Worker (scope: /pos)
// Cachea la app shell para funcionamiento offline completo

const CACHE_NAME = 'pos-qc-v1'
const APP_SHELL = [
  '/pos',
  '/pos/manifest.json',
]

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first for navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Solo interceptar requests dentro del scope /pos
  if (!url.pathname.startsWith('/pos') && !url.pathname.startsWith('/_next/')) {
    return
  }

  // Navigation requests: network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/pos')))
    )
    return
  }

  // Static assets (JS, CSS, fonts): stale-while-revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        return cached || fetchPromise
      })
    )
    return
  }

  // API/Supabase calls: network only (sync handles offline)
  event.respondWith(fetch(event.request))
})
