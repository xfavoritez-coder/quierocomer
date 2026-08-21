// POS QuieroComer — Service Worker (scope: /pos)
// Cachea la app shell para funcionamiento offline completo

const CACHE_NAME = 'pos-qc-v2'

// Páginas a pre-cachear en install (deben existir y devolver 200)
const APP_SHELL = [
  '/pos',
  '/pos/comandero',
]

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll falla si alguna URL falla — usamos add individual para no romper todo
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    )
  )
  self.skipWaiting()
})

// Activate: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Solo interceptar requests del mismo origen
  if (url.origin !== self.location.origin) return

  // ── Assets estáticos de Next.js: cache-first, actualizar en background ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        const fetchPromise = fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone())
          return res
        }).catch(() => null)
        return cached || fetchPromise
      })
    )
    return
  }

  // ── Páginas /pos (navegación + RSC de Next.js App Router) ──
  if (url.pathname.startsWith('/pos')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Intentar red primero
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(event.request, res.clone())
          return res
        } catch {
          // Offline: buscar en cache
          const cached = await cache.match(event.request)
          if (cached) return cached
          // Fallback: servir /pos como app shell
          const shell = await cache.match('/pos')
          return shell || new Response('Offline — abre el POS mientras tengas conexión', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
      })
    )
    return
  }

  // ── API calls y todo lo demás: red directa, sin caché ──
  // (Supabase, /api/pos/*, etc. — el código maneja errores de red)
})
