// POS QuieroComer — Service Worker (scope: /pos)
// v3: solo intercepta navigate mode — no RSC, no API calls

const CACHE_NAME = 'pos-qc-v3'

const APP_SHELL = [
  '/pos',
  '/pos/comandero',
  '/pos/cuenta',
]

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    )
  )
  self.skipWaiting()
})

// Activate: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Solo mismo origen
  if (url.origin !== self.location.origin) return

  // ── Assets estáticos Next.js: cache-first + revalidar en background ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        const network = fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone())
          return res
        }).catch(() => null)
        return cached || network
      })
    )
    return
  }

  // ── Navegación directa a /pos (modo navigate ÚNICAMENTE) ──
  // NO interceptar RSC requests (mode !== 'navigate') — devolver HTML como RSC rompe React
  if (event.request.mode === 'navigate' && url.pathname.startsWith('/pos')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(event.request, res.clone())
          return res
        } catch {
          // Offline: buscar página exacta, luego /pos como shell
          return (
            (await cache.match(event.request)) ||
            (await cache.match('/pos')) ||
            new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>POS sin conexión</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F5F4F1"><div style="text-align:center"><div style="font-size:2rem;margin-bottom:12px">📵</div><div style="font-weight:700;font-size:1.1rem;margin-bottom:8px">Sin conexión</div><p style="color:#6e6b64;font-size:.9rem">Abre el POS con internet primero para que funcione offline.</p><button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;border-radius:10px;border:none;background:#DE7C00;color:#fff;font-weight:600;cursor:pointer">Reintentar</button></div></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          )
        }
      })
    )
    return
  }

  // Todo lo demás (RSC, API, Supabase): red directa, el cliente maneja errores
})
