import { NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

type PlaceInput = {
  id: string
  name: string
  address: string
  mapsUrl: string
  website?: string | null   // URL del website en Google Maps (puede ser UberEats, PedidosYa, etc.)
}

type LocalesFeedEntry = {
  name: string
  website: string
  provider: string
  comuna: string
}

type ProspectoResult = {
  id: string
  name: string
  address: string
  mapsUrl: string
  status: 'encontrado' | 'sin_plataforma' | 'sin_fotos'
  provider?: string
  cartaUrl?: string
  fuenteMatch?: 'locales-feed' | 'slug' | 'maps-website'
  alternatives?: Array<{ provider: string; url: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-')
}

function normName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

// Detecta qué proveedor es una URL conocida
function detectProvider(url: string): string | null {
  if (url.includes('ubereats.com'))    return 'UberEats'
  if (url.includes('pedidosya.com'))   return 'PedidosYa'
  if (url.includes('rappi.com') || url.includes('rappi.cl')) return 'Rappi'
  if (url.includes('fu.do'))           return 'Fudo'
  if (url.includes('/pedir'))          return 'Justo'  // kokai.cl/pedir — Justo embebido
  if (url.includes('gour.media'))      return 'Gourmedia'
  if (url.includes('ola.click'))       return 'OlaClick'
  if (url.includes('toteat.app'))      return 'Toteat'
  if (url.includes('getjusto.com'))    return 'Justo'
  return null
}

// Detecta proveedor desde el contenido HTML de la página (para webs propias como Mercat)
// ORDEN IMPORTA: más específicos primero para evitar falsos positivos
function detectProviderFromHtml(html: string): string {
  if (html.includes('mer-cat.com'))                                                                                          return 'Mercat'
  if (html.includes('getjusto.com') || html.includes('"/pedir"') || html.includes("'/pedir'") || html.includes('/pedir/')) return 'Justo'
  if (html.includes('ubereats.com'))                                                                                         return 'UberEats'
  if (html.includes('pedidosya'))                                                                                             return 'PedidosYa'
  if (html.includes('rappi.cl') || html.includes('rappi.com'))                                                               return 'Rappi'
  if (html.includes('toteat'))                                                                                                return 'Toteat'
  if (html.includes('ola.click'))                                                                                             return 'OlaClick'
  // Solo detectar Gourmedia si hay un link a un menú real (slug de restaurante, no assets/CSS)
  if (/gour\.media\/[a-z0-9][a-z0-9-]{1,60}\/?["'\s<>&]/i.test(html))                                                      return 'Gourmedia'
  if (html.includes('fu.do/') || html.includes('menu.fu.do') || html.includes('app.fu.do'))                                 return 'Fudo'
  return 'Web propia'
}

// Intenta extraer la URL real de Justo desde el HTML
function extractJustoUrl(html: string, websiteBase: string): string {
  // Preferir /pedir del mismo sitio (más limpio y siempre funciona)
  if (html.includes('/pedir')) return new URL('/pedir', websiteBase).toString()
  // Buscar iframe o script con URL de getjusto.com — excluir CDN de imágenes (tofuu.getjusto.com)
  const matches = html.matchAll(/https?:\/\/([^"'\s<>&]*getjusto\.com[^"'\s<>&]*)/gi)
  for (const m of matches) {
    const u = m[0].split('?')[0]
    // Skip CDN image URLs
    if (u.includes('tofuu.getjusto.com')) continue
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(u)) continue
    return u
  }
  // Fallback: /pedir
  return new URL('/pedir', websiteBase).toString()
}

// Carga locales-feed.json una sola vez
let feedCache: LocalesFeedEntry[] | null = null
function getLocalesFeed(): LocalesFeedEntry[] {
  if (!feedCache) {
    const p = path.join(process.cwd(), 'public', 'locales-feed.json')
    feedCache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []
  }
  return feedCache!
}

function matchInFeed(name: string): LocalesFeedEntry | null {
  const feed = getLocalesFeed()
  const needle = normName(name)
  return feed.find(e => normName(e.name) === needle) ?? null
}

// Plataformas que siempre tienen fotos si la URL existe (SPAs que no se pueden scraper)
// No hace falta hasPhotos — si la URL es válida, tiene fotos (lo exigen estas plataformas)
const TRUSTED_PLATFORMS = new Set(['Fudo', 'Justo', 'OlaClick', 'Toteat', 'Gourmedia', 'UberEats', 'PedidosYa'])

// Prioridad de proveedores (menor índice = mejor)
const PROVIDER_PRIORITY = ['UberEats', 'Justo', 'Rappi', 'PedidosYa', 'Mercat', 'Gourmedia', 'OlaClick', 'Fudo', 'Toteat', 'Web propia']
function providerRank(p: string) { const i = PROVIDER_PRIORITY.indexOf(p); return i === -1 ? 99 : i }

// URLs candidatas por plataforma usando slug (Fudo EXCLUIDO: siempre retorna 200)
function candidateUrls(slug: string): Array<{ provider: string; url: string }> {
  return [
    { provider: 'PedidosYa', url: `https://www.pedidosya.cl/restaurantes/santiago/${slug}-menu` },
    { provider: 'PedidosYa', url: `https://www.pedidosya.cl/restaurantes/santiago/${slug}` },
    { provider: 'Gourmedia', url: `https://gour.media/${slug}` },
    { provider: 'OlaClick',  url: `https://${slug}.ola.click` },
    { provider: 'Toteat',    url: `https://${slug}.toteat.app` },
  ]
}

// CDNs de imágenes de comida conocidas — se buscan en TODO el HTML (img tags + JSON embebido)
const FOOD_IMAGE_CDNS = [
  // Plataformas digitales de carta
  'bistrify.app', 'tofuu.', 'orioneat', 'gour.media',
  'ola.click', 'influye.app', 'mer-cat.com', 'fu.do', 'toteat',
  // Storage genérico usado por plataformas de comida
  'supabase.co', 'cloudinary.com', 'cloudfront.net', 'awbeyxfq',
  // Mercat (web propia del restaurante con CDN de Mercat)
  'mer-cat.com', 'mercat',
  // Delivery platforms
  'tb-static.uber.com', 'ubereats.com/image',
  'photos.pystatic.com', 'pedidosya', 'dhmjoppcxbv4f',
  'rappi.com', 'rappi.cl', 'rappipay',
  'getjusto.com',
]

// Busca URLs de imágenes en TODO el HTML (img tags + JSON embebido en scripts)
async function hasPhotos(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return false
    const html = await res.text()

    // 1. Buscar en <img src="..."> tags
    const imgMatches = html.match(/src=["'][^"']{10,}["']/gi) ?? []
    const hasImgCdn = imgMatches.some(tag => FOOD_IMAGE_CDNS.some(cdn => tag.includes(cdn)))
    if (hasImgCdn) return true

    // 2. Buscar en todo el HTML (JSON embebido, __NEXT_DATA__, variables JS, background-image)
    // Esto detecta SPAs como Toteat/Fudo que inyectan datos en <script> tags
    const hasAnyCdn = FOOD_IMAGE_CDNS.some(cdn => html.includes(cdn))
    if (hasAnyCdn) {
      // Verificar que hay al menos una URL de imagen real (termina en extensión de imagen o es de CDN de fotos)
      const imageUrlPattern = new RegExp(
        `(${FOOD_IMAGE_CDNS.map(c => c.replace('.', '\\.')).join('|')})[^"'\\s]{3,}`,
        'i'
      )
      return imageUrlPattern.test(html)
    }

    return false
  } catch {
    return false
  }
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    })
    return res.ok
  } catch {
    return false
  }
}

// Busca en DuckDuckGo HTML vía POST — funciona sin bot-blocking, retorna URLs sin protocolo.
async function ddgSearch(query: string, fragment: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
        'Accept-Language': 'es-CL,es;q=0.9',
      },
      body: `q=${encodeURIComponent(query)}&kl=cl-es`,
    })
    if (!res.ok) return null
    const html = await res.text()

    // DDG muestra URLs sin protocolo en el HTML: "ubereats.com/cl/store/slug/HASH"
    // Buscar el fragment directamente y extraer la URL completa
    const idx = html.indexOf(fragment)
    if (idx !== -1) {
      // Buscar el inicio de la URL (puede tener https:// o www. delante o nada)
      const start = Math.max(0, idx - 12) // retroceder para capturar posible "https://www."
      const chunk = html.slice(start, idx + fragment.length + 200)
      const m = chunk.match(/(?:https?:\/\/(?:www\.)?|(?:www\.)?)?([a-z0-9.-]+\.(?:com|cl)\/[^\s"'<>&]{5,})/)
      if (m) {
        const path = m[1].split('?')[0]
        if (path.includes(fragment)) return `https://www.${path.replace(/^www\./, '')}`
      }
      // Fallback: tomar directamente desde el índice del fragment
      const raw = html.slice(idx).match(/^[^\s"'<>&]+/)
      if (raw) return `https://www.${fragment}${raw[0].slice(fragment.length)}`.split('?')[0]
    }

    return null
  } catch {
    return null
  }
}

// Busca URL de UberEats / Justo / Rappi / PedidosYa via DuckDuckGo.
// Prueba las 4 plataformas EN PARALELO — mucho más rápido.
async function searchDeliveryUrl(name: string, address: string): Promise<Array<{ provider: string; url: string }>> {
  const commune = address.split(',').slice(-3)[0]?.trim() ?? ''

  const platforms = [
    {
      provider: 'UberEats',
      fragment: 'ubereats.com/cl/store/',
      queries: [`${name} site:ubereats.com`, `${name} ubereats`, `${name} ${commune} ubereats`],
    },
    {
      provider: 'Justo',
      fragment: 'getjusto.com',
      queries: [`${name} site:getjusto.com`, `${name} justo pedidos online`, `${name} ${commune} getjusto`],
    },
    {
      provider: 'Rappi',
      fragment: 'rappi.cl/restaurantes/',
      queries: [`${name} site:rappi.cl`, `${name} rappi chile`, `${name} ${commune} rappi`],
    },
    {
      provider: 'PedidosYa',
      fragment: 'pedidosya.cl/restaurantes/',
      queries: [`${name} site:pedidosya.cl`, `${name} pedidosya chile`, `${name} ${commune} pedidosya`],
    },
  ]

  // Correr todas las plataformas en paralelo — de 48s+ secuencial a ~8s paralelo
  const settled = await Promise.all(
    platforms.map(async ({ provider, fragment, queries }) => {
      for (const query of queries) {
        const url = await ddgSearch(query, fragment, 8000)
        if (url) return { provider, url }
      }
      return null
    })
  )

  return settled.filter((r): r is { provider: string; url: string } => r !== null)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { places } = (await req.json()) as { places: PlaceInput[] }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  async function send(data: object) {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + '\n'))
    } catch {} // cliente desconectado — ignorar
  }

  async function saveResult(result: ProspectoResult) {
    await prisma.mapaProspecto.upsert({
      where: { id: result.id },
      create: {
        id: result.id,
        name: result.name,
        address: result.address,
        mapsUrl: result.mapsUrl,
        status: result.status,
        provider: result.provider ?? null,
        cartaUrl: result.cartaUrl ?? null,
        fuenteMatch: result.fuenteMatch ?? null,
      },
      update: {
        status: result.status,
        provider: result.provider ?? null,
        cartaUrl: result.cartaUrl ?? null,
        fuenteMatch: result.fuenteMatch ?? null,
      },
    })
  }

  ;(async () => {
    try {
    await send({ type: 'total', total: places.length })

    let encontrados = 0
    let sinPlataforma = 0
    let sinFotos = 0

    for (let i = 0; i < places.length; i++) {
      const place = places[i]
      send({ type: 'progress', current: i + 1, id: place.id, name: place.name })

      // Recolectamos TODAS las fuentes encontradas para luego elegir la mejor por prioridad
      type Source = { provider: string; url: string; fuenteMatch: 'maps-website' | 'locales-feed' | 'slug' }
      const allSources: Source[] = []
      const seenProviders = new Set<string>()
      function addSource(s: Source) {
        if (!seenProviders.has(s.provider)) {
          seenProviders.add(s.provider)
          allSources.push(s)
        }
      }

      // 0️⃣ Website de Google Maps (plataforma conocida o web propia con carta embebida)
      if (place.website) {
        const mapsProvider = detectProvider(place.website)
        send({ type: 'status', name: place.name, message: `Revisando ${mapsProvider ?? 'web del local'}...` })
        let html = ''
        const photos = await (async () => {
          try {
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), 10000)
            const res = await fetch(place.website!, {
              signal: ctrl.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-CL,es;q=0.9',
              },
              redirect: 'follow',
            })
            clearTimeout(timer)
            if (!res.ok) return false
            html = await res.text()
            const imgMatches = html.match(/src=["'][^"']{10,}["']/gi) ?? []
            if (imgMatches.some(tag => FOOD_IMAGE_CDNS.some(cdn => tag.includes(cdn)))) return true
            if (FOOD_IMAGE_CDNS.some(cdn => html.includes(cdn))) {
              const pat = new RegExp(`(${FOOD_IMAGE_CDNS.map(c => c.replace('.', '\\.')).join('|')})[^"'\\s]{3,}`, 'i')
              return pat.test(html)
            }
            return false
          } catch { return false }
        })()

        const detectedProvider = mapsProvider ?? (html ? detectProviderFromHtml(html) : null)
        const effectivePhotos = photos || (!!detectedProvider && TRUSTED_PLATFORMS.has(detectedProvider) && html.length > 500)

        if (effectivePhotos && detectedProvider) {
          let cartaUrl = place.website!
          if (detectedProvider === 'Justo') {
            cartaUrl = extractJustoUrl(html, place.website!)
          } else if (detectedProvider === 'UberEats') {
            const m = html.match(/https?:\/\/www\.ubereats\.com\/cl\/store\/[^"'\s<>&]{5,}/i)
            if (m) cartaUrl = m[0].split('?')[0]
          } else if (detectedProvider === 'PedidosYa') {
            const m = html.match(/https?:\/\/www\.pedidosya\.cl\/restaurantes\/[^"'\s<>&]{5,}/i)
            if (m) cartaUrl = m[0].split('?')[0]
          } else if (detectedProvider === 'Fudo') {
            const m = html.match(/https?:\/\/(?:menu|app)\.fu\.do\/[^"'\s<>&]{3,}/i)
            if (m) cartaUrl = m[0].split('?')[0]
          } else if (detectedProvider === 'OlaClick') {
            const m = html.match(/https?:\/\/[^"'\s<>&]+\.ola\.click[^"'\s<>&]*/i)
            if (m) cartaUrl = m[0].split('?')[0]
          } else if (detectedProvider === 'Gourmedia') {
            // Solo URLs tipo gour.media/slug (un segmento, no assets como custom_styles/, fonts/, etc.)
            const m = html.match(/https?:\/\/gour\.media\/([a-z0-9][a-z0-9-]{1,60})\/?(?:["'\s<>&]|$)/i)
            if (m) cartaUrl = `https://gour.media/${m[1]}`
          }
          addSource({ provider: detectedProvider, url: cartaUrl, fuenteMatch: 'maps-website' })
        }
      }

      // 1️⃣ Buscar en plataformas de delivery via DDG (UberEats, Justo, Rappi, PedidosYa) — en paralelo
      send({ type: 'status', name: place.name, message: `Buscando en UberEats, Justo, Rappi, PedidosYa...` })
      const deliveryHits = await searchDeliveryUrl(place.name, place.address)
      for (const { provider, url } of deliveryHits) {
        if (!seenProviders.has(provider)) {
          // DDG ya encontró la URL — confiamos en que existe, sin HEAD check extra
          addSource({ provider, url, fuenteMatch: 'maps-website' })
        }
      }

      // 2️⃣ Cruzar con locales-feed.json
      const feedMatch = matchInFeed(place.name)
      if (feedMatch && !seenProviders.has(feedMatch.provider)) {
        // Para plataformas de confianza, no hace falta verificar fotos — siempre tienen
        const trusted = TRUSTED_PLATFORMS.has(feedMatch.provider)
        if (trusted) {
          addSource({ provider: feedMatch.provider, url: feedMatch.website, fuenteMatch: 'locales-feed' })
        } else {
          send({ type: 'status', name: place.name, message: `En locales-feed (${feedMatch.provider}) — verificando...` })
          const photos = await hasPhotos(feedMatch.website)
          if (photos) {
            addSource({ provider: feedMatch.provider, url: feedMatch.website, fuenteMatch: 'locales-feed' })
          }
        }
      }

      // 3️⃣ Probar slug en plataformas restantes (en paralelo para mayor velocidad)
      const slug = slugify(place.name)
      send({ type: 'status', name: place.name, message: `Probando plataformas con slug "${slug}"...` })
      const slugCandidates = candidateUrls(slug).filter(c => !seenProviders.has(c.provider))
      // Deduplicar por proveedor (PedidosYa tiene dos URLs candidatas)
      const seenSlugProviders = new Set<string>()
      const uniqueSlugCandidates = slugCandidates.filter(c => {
        if (seenSlugProviders.has(c.provider)) return false
        seenSlugProviders.add(c.provider)
        return true
      })
      const slugResults = await Promise.all(
        uniqueSlugCandidates.map(async ({ provider, url }) => {
          const exists = await urlExists(url)
          return exists ? { provider, url } : null
        })
      )
      for (const hit of slugResults) {
        if (hit) addSource({ provider: hit.provider, url: hit.url, fuenteMatch: 'slug' })
      }

      // Elegir la mejor fuente según prioridad de proveedor
      allSources.sort((a, b) => providerRank(a.provider) - providerRank(b.provider))

      if (allSources.length > 0) {
        const best = allSources[0]
        const alternatives = allSources.slice(1).map(s => ({ provider: s.provider, url: s.url }))
        encontrados++
        const result: ProspectoResult = {
          ...place,
          status: 'encontrado',
          provider: best.provider,
          cartaUrl: best.url,
          fuenteMatch: best.fuenteMatch,
          ...(alternatives.length > 0 ? { alternatives } : {}),
        }
        saveResult(result).catch(() => {})
        send({ type: 'result', result })
      } else {
        sinPlataforma++
        const result: ProspectoResult = { ...place, status: 'sin_plataforma' }
        saveResult(result).catch(() => {})
        send({ type: 'result', result })
      }

      if (i < places.length - 1) await new Promise(r => setTimeout(r, 200))
    }

    await send({ type: 'done', encontrados, sinPlataforma, sinFotos })
    } catch (e: any) {
      try { await send({ type: 'error', message: e?.message ?? 'Error inesperado' }) } catch {}
    } finally {
      try { writer.close() } catch {}
    }
  })()

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
