// POS QuieroComer — Service Worker v6
// Solo intercepta requests navigate (HTML) para /pos/*.
// Los RSC fetch (router.push online) pasan directo a la red → SPA instantáneo.
// Offline: location.assign() desde el cliente → siempre llega como navigate → SW sirve HTML cacheado.

const CACHE_NAME = 'pos-qc-v6'
const APP_SHELL = ['/pos', '/pos/comandero', '/pos/cuenta', '/pos/cobro', '/pos/caja']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Solo mismo origen
  if (url.origin !== self.location.origin) return

  // /_next/static/: stale-while-revalidate (assets inmutables con hash)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request)
        const network = fetch(event.request)
          .then(res => { if (res.ok) cache.put(event.request, res.clone()); return res })
          .catch(() => null)
        return cached || network
      })
    )
    return
  }

  // /pos/* navigate: network-first con fallback a cache (soporte offline)
  if (url.pathname.startsWith('/pos') && event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(url.pathname, res.clone())
          return res
        } catch {
          // Offline: servir HTML cacheado por pathname (sin query params)
          return (
            (await cache.match(url.pathname)) ||
            (await cache.match('/pos')) ||
            new Response(offlinePage(), {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          )
        }
      })
    )
    return
  }

  // Todo lo demás (RSC fetches, /api, Supabase, etc.): red directa sin interceptar
})

function offlinePage() {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>POS — Sin conexión</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F4F1;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#fff;border:1px solid #EAE8E2;border-radius:20px;padding:36px 28px;max-width:320px;width:100%;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)}.icon{font-size:2.5rem;margin-bottom:16px}.title{font-weight:700;font-size:1.1rem;margin-bottom:8px}.desc{color:#6E6B64;font-size:.875rem;line-height:1.5;margin-bottom:24px}.btn{display:inline-block;background:#DE7C00;color:#fff;font-weight:600;font-size:.9rem;padding:12px 24px;border-radius:12px;border:none;cursor:pointer;width:100%}.btn:hover{background:#B86500}</style></head><body><div class="card"><div class="icon">📵</div><div class="title">Sin conexión</div><p class="desc">Para usar el POS sin internet, primero ábrelo mientras tienes conexión y navega las páginas una vez.</p><button class="btn" onclick="location.reload()">Reintentar</button></div></body></html>`
}
