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
  if (url.includes('rappi.com'))       return 'Rappi'
  if (url.includes('fu.do'))           return 'Fudo'
  if (url.includes('/pedir'))          return 'Justo'  // kokai.cl/pedir — Justo embebido
  if (url.includes('gour.media'))      return 'Gourmedia'
  if (url.includes('ola.click'))       return 'OlaClick'
  if (url.includes('toteat.app'))      return 'Toteat'
  if (url.includes('getjusto.com'))    return 'Justo'
  return null
}

// Detecta proveedor desde el contenido HTML de la página (para webs propias como Mercat)
function detectProviderFromHtml(html: string): string {
  if (html.includes('mer-cat.com'))                                      return 'Mercat'
  if (html.includes('fu.do') || html.includes('fudo'))                   return 'Fudo'
  if (html.includes('toteat'))                                            return 'Toteat'
  if (html.includes('ola.click'))                                         return 'OlaClick'
  if (html.includes('gour.media'))                                        return 'Gourmedia'
  if (html.includes('ubereats.com'))                                      return 'UberEats'
  if (html.includes('pedidosya'))                                         return 'PedidosYa'
  if (html.includes('getjusto.com') || html.includes('"/pedir"') || html.includes("'/pedir'") || html.includes('/pedir/')) return 'Justo'
  return 'Web propia'
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

// URLs candidatas por plataforma usando slug
// Orden de prioridad: primero las que probablemente tienen más fotos de calidad
function candidateUrls(slug: string): Array<{ provider: string; url: string }> {
  return [
    // PedidosYa Chile usa slugs predecibles → va primero (delivery con fotos)
    { provider: 'PedidosYa', url: `https://www.pedidosya.cl/restaurantes/santiago/${slug}-menu` },
    { provider: 'PedidosYa', url: `https://www.pedidosya.cl/restaurantes/santiago/${slug}` },
    // Fudo (carta digital con fotos)
    { provider: 'Fudo',      url: `https://menu.fu.do/${slug}` },
    { provider: 'Fudo',      url: `https://app.fu.do/${slug}/qr-menu` },
    // Resto de plataformas
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
  'rappi.com', 'rappipay',
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

// Busca URL de UberEats o PedidosYa usando Bing HTML (mejor cobertura que DDG para estas plataformas)
async function searchDeliveryUrl(name: string, address: string): Promise<Array<{ provider: string; url: string }>> {
  const commune = address.split(',').slice(-3)[0]?.trim() ?? ''
  const results: Array<{ provider: string; url: string }> = []

  const searches = [
    {
      provider: 'UberEats',
      query: `${name} ${commune} ubereats`,
      pattern: /https?:\/\/www\.ubereats\.com\/cl\/store\/[^"'\s<>&]{5,}/gi,
    },
    {
      provider: 'PedidosYa',
      query: `${name} ${commune} pedidosya`,
      pattern: /https?:\/\/www\.pedidosya\.cl\/restaurantes\/[^"'\s<>&]{5,}/gi,
    },
  ]

  for (const { provider, query, pattern } of searches) {
    try {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 9000)
      const res = await fetch(
        `https://www.bing.com/search?q=${encodeURIComponent(query)}&mkt=es-CL&setmkt=es-CL&setlang=es-CL`,
        {
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-CL,es;q=0.9',
          },
        }
      )
      if (!res.ok) continue
      const html = await res.text()

      const matches = [...html.matchAll(pattern)]
      if (matches.length > 0) {
        // Limpiar tracking params y entidades HTML
        const url = matches[0][0].replace(/&amp;/g, '&').split('?')[0]
        results.push({ provider, url })
      }
    } catch {}
  }

  return results
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { places } = (await req.json()) as { places: PlaceInput[] }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  function send(data: object) {
    writer.write(encoder.encode(JSON.stringify(data) + '\n'))
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
    send({ type: 'total', total: places.length })

    let encontrados = 0
    let sinPlataforma = 0
    let sinFotos = 0

    for (let i = 0; i < places.length; i++) {
      const place = places[i]
      send({ type: 'progress', current: i + 1, id: place.id, name: place.name })

      // 0️⃣ Chequear website de Google Maps (plataforma conocida o web propia con carta embebida)
      if (place.website) {
        const mapsProvider = detectProvider(place.website)
        const label = mapsProvider ?? 'web del local'
        send({ type: 'status', name: place.name, message: `Revisando ${label}...` })

        // hasPhotosWithHtml devuelve { photos, html } para poder detectar el proveedor desde el contenido
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

        if (photos) {
          encontrados++
          const provider = mapsProvider ?? detectProviderFromHtml(html)
          // Si es Justo embebido en web propia, la carta está en /pedir
          const cartaUrl = provider === 'Justo' && !place.website!.includes('/pedir')
            ? new URL('/pedir', place.website!).toString()
            : place.website!
          const result: ProspectoResult = { ...place, status: 'encontrado', provider, cartaUrl, fuenteMatch: 'maps-website' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
          continue
        } else {
          send({ type: 'status', name: place.name, message: `${label}: sin fotos detectadas, siguiendo...` })
        }
      }

      // 1️⃣ Buscar en UberEats / PedidosYa vía Bing
      // UberEats y PedidosYa bloquean bots — si Bing encontró la URL, confiamos que tiene fotos (lo exigen)
      send({ type: 'status', name: place.name, message: `Buscando en UberEats y PedidosYa...` })
      const deliveryHits = await searchDeliveryUrl(place.name, place.address)
      let deliveryFound = false
      for (const { provider, url } of deliveryHits) {
        send({ type: 'status', name: place.name, message: `${provider}: verificando que existe...` })
        const exists = await urlExists(url)
        if (exists) {
          encontrados++
          deliveryFound = true
          const result: ProspectoResult = { ...place, status: 'encontrado', provider, cartaUrl: url, fuenteMatch: 'maps-website' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
          break
        } else {
          send({ type: 'status', name: place.name, message: `${provider}: URL no válida, siguiendo...` })
        }
      }
      if (deliveryFound) continue

      // 2️⃣ Cruzar con locales-feed.json
      const feedMatch = matchInFeed(place.name)
      if (feedMatch) {
        send({ type: 'status', name: place.name, message: `En locales-feed (${feedMatch.provider}) — verificando fotos...` })
        const photos = await hasPhotos(feedMatch.website)
        if (photos) {
          encontrados++
          const result: ProspectoResult = { ...place, status: 'encontrado', provider: feedMatch.provider, cartaUrl: feedMatch.website, fuenteMatch: 'locales-feed' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
        } else {
          sinFotos++
          send({ type: 'status', name: place.name, message: `⚠ En locales-feed pero sin fotos detectadas` })
          const result: ProspectoResult = { ...place, status: 'sin_fotos', provider: feedMatch.provider, cartaUrl: feedMatch.website, fuenteMatch: 'locales-feed' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
        }
        continue
      }

      // 3️⃣ Probar slug en cada plataforma
      const slug = slugify(place.name)
      send({ type: 'status', name: place.name, message: `Probando plataformas con slug "${slug}"...` })

      let found = false
      let bestSinFotos: { provider: string; url: string } | null = null

      for (const { provider, url } of candidateUrls(slug)) {
        const exists = await urlExists(url)
        if (!exists) continue

        send({ type: 'status', name: place.name, message: `Encontrado en ${provider} — verificando fotos...` })
        const photos = await hasPhotos(url)

        if (photos) {
          encontrados++
          found = true
          const result: ProspectoResult = { ...place, status: 'encontrado', provider, cartaUrl: url, fuenteMatch: 'slug' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
          break
        } else {
          send({ type: 'status', name: place.name, message: `${provider}: URL existe pero sin fotos detectadas` })
          if (!bestSinFotos) bestSinFotos = { provider, url }
        }
      }

      if (!found) {
        if (bestSinFotos) {
          sinFotos++
          const result: ProspectoResult = { ...place, status: 'sin_fotos', provider: bestSinFotos.provider, cartaUrl: bestSinFotos.url, fuenteMatch: 'slug' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
        } else {
          sinPlataforma++
          const result: ProspectoResult = { ...place, status: 'sin_plataforma' }
          saveResult(result).catch(() => {})
          send({ type: 'result', result })
        }
      }

      if (i < places.length - 1) await new Promise(r => setTimeout(r, 200))
    }

    send({ type: 'done', encontrados, sinPlataforma, sinFotos })
    writer.close()
  })()

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
