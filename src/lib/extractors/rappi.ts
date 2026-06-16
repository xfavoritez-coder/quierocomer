/**
 * Rappi extractor — múltiples estrategias:
 * 1. Fetch directo buscando corridors JSON en SSR
 * 2. Jina con wait selector (SPA rendering)
 * 3. API interna de Rappi
 * 4. JSON-LD estructurado
 * 5. Parseo de HTML renderizado por Jina
 */
import type { ExtractionResult, ExtractedDish } from './types'

const IMAGE_BASE = 'https://images.rappi.cl/products/'

type RappiProduct = {
  id: number
  name: string
  description: string
  price: number
  realPrice: number
  isAvailable: boolean
  image: string
}

type RappiCorridor = {
  name: string
  products: RappiProduct[]
}

/** Busca "corridors": [...] en cualquier texto (HTML o JS inline) */
function extractCorridorsFromText(text: string): RappiCorridor[] | null {
  const match = text.match(/"corridors"\s*:\s*\[/)
  if (!match || match.index == null) return null

  const arrayStart = match.index + match[0].length - 1
  if (text[arrayStart] !== '[') return null

  let depth = 0
  let arrayEnd = arrayStart
  for (let i = arrayStart; i < text.length; i++) {
    const ch = text[i]
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 0) { arrayEnd = i; break }
    }
  }

  try {
    const arr = JSON.parse(text.substring(arrayStart, arrayEnd + 1))
    if (Array.isArray(arr) && arr.length > 0) return arr
    return null
  } catch {
    return null
  }
}

function corridorsToDishes(corridors: RappiCorridor[]): ExtractedDish[] {
  const dishes: ExtractedDish[] = []
  for (const corridor of corridors) {
    if (!Array.isArray(corridor.products)) continue
    for (const p of corridor.products) {
      if (!p.name?.trim()) continue
      const price = p.price ?? p.realPrice ?? 0
      const imageUrl = p.image ? `${IMAGE_BASE}${p.image}` : null
      dishes.push({
        name: p.name.trim(),
        description: p.description?.trim() || '',
        price,
        imageUrl,
        category: corridor.name?.trim() || '',
      })
    }
  }
  return dishes
}

/** Parsea JSON-LD hasMenu/hasMenuSection/hasMenuItem */
function extractDishesFromJsonLd(html: string): ExtractedDish[] {
  const dishes: ExtractedDish[] = []
  const scriptPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1])
      const menus = Array.isArray(data) ? data : [data]
      for (const obj of menus) {
        const menuObj = obj?.hasMenu ?? obj
        const sections = menuObj?.hasMenuSection
        if (!sections) continue
        const sectArr = Array.isArray(sections) ? sections : [sections]
        for (const sect of sectArr) {
          const items = sect?.hasMenuItem
          if (!items) continue
          const itemArr = Array.isArray(items) ? items : [items]
          for (const item of itemArr) {
            const name = item?.name
            if (!name) continue
            const price = item?.offers?.price ?? item?.offers?.[0]?.price ?? 0
            dishes.push({
              name: String(name).trim(),
              description: String(item?.description ?? '').trim(),
              price: Number(price) || 0,
              imageUrl: item?.image ?? null,
              category: sect?.name ?? '',
            })
          }
        }
      }
    } catch { /* ignorar JSON inválido */ }
  }
  return dishes
}

/**
 * Parsea el HTML renderizado de Rappi buscando elementos de producto.
 * Rappi renderiza cada producto con su nombre, precio e imagen en el DOM.
 * Busca atributos data-* y patrones de texto con precios.
 */
function extractDishesFromRenderedHtml(html: string): ExtractedDish[] {
  const dishes: ExtractedDish[] = []

  // Buscar cualquier JSON en <script> tags que tenga products/name/price
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? []
  for (const tag of scriptTags) {
    const content = tag.replace(/<script[^>]*>|<\/script>/gi, '')
    // Buscar arrays de productos: [{name:...,price:...}]
    const productArrayMatch = content.match(/\[\s*\{[\s\S]*?"name"\s*:[\s\S]*?"price"[\s\S]*?\}/)
    if (productArrayMatch) {
      try {
        // Encontrar y parsear el array completo
        const startIdx = content.indexOf(productArrayMatch[0])
        let depth = 0, endIdx = startIdx
        for (let i = startIdx; i < content.length; i++) {
          if (content[i] === '[' || content[i] === '{') depth++
          else if (content[i] === ']' || content[i] === '}') {
            depth--
            if (depth === 0) { endIdx = i; break }
          }
        }
        const arr = JSON.parse(content.substring(startIdx, endIdx + 1))
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item?.name && (item?.price != null || item?.realPrice != null)) {
              dishes.push({
                name: String(item.name).trim(),
                description: String(item.description ?? '').trim(),
                price: Number(item.price ?? item.realPrice ?? 0),
                imageUrl: item.image ? `${IMAGE_BASE}${item.image}` : null,
                category: '',
              })
            }
          }
        }
      } catch { /* ignorar */ }
    }
  }

  return dishes
}

async function fetchWithJina(url: string, waitSelector?: string, timeoutMs = 35000): Promise<string> {
  const headers: Record<string, string> = {
    'Accept': 'text/html,*/*',
    'X-Return-Format': 'html',
    'X-Timeout': String(timeoutMs - 2000), // tell Jina slightly less than our local timeout
  }
  if (waitSelector) headers['X-Wait-For-Selector'] = waitSelector

  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`)
  return res.text()
}

export async function extractRappi(url: string): Promise<ExtractionResult> {
  let html = ''
  let corridors: RappiCorridor[] | null = null

  // ── Intento 1: fetch directo ──────────────────────────────────────────────
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9',
        'Referer': 'https://www.rappi.cl/',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      html = await res.text()
      corridors = extractCorridorsFromText(html)
    }
  } catch { /* continuar */ }

  // ── Intento 2: Jina con wait selector (SPA) ───────────────────────────────
  if (!corridors?.length) {
    try {
      // Selectores comunes en la SPA de Rappi
      const waitSelector = '[data-testid*="product"],[class*="corridor"],[class*="product-card"],[class*="menu-product"]'
      const jinaHtml = await fetchWithJina(url, waitSelector)
      corridors = extractCorridorsFromText(jinaHtml)
      if (corridors?.length) {
        html = jinaHtml
      } else {
        // Guardar el HTML de Jina para parseo de fallback
        if (jinaHtml.length > html.length) html = jinaHtml
      }
    } catch { /* continuar */ }
  }

  // ── Intento 3: APIs internas de Rappi ────────────────────────────────────
  if (!corridors?.length) {
    const rappiIdMatch = url.match(/\/(\d{6,})[-/]/)
    if (rappiIdMatch) {
      const rappiId = rappiIdMatch[1]
      const apiUrls = [
        `https://services.rappi.cl/api/restaurants/unified-menu?restaurant_id=${rappiId}`,
        `https://services.rappi.cl/api/web-gateway/web/restaurants-bus/unified-menu/${rappiId}`,
        `https://rappi.cl/api/restaurants/unified-menu?store_id=${rappiId}`,
      ]
      for (const apiUrl of apiUrls) {
        try {
          const res = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Referer': 'https://www.rappi.cl/',
              'Origin': 'https://www.rappi.cl',
            },
            signal: AbortSignal.timeout(10000),
          })
          if (res.ok) {
            const text = await res.text()
            corridors = extractCorridorsFromText(text)
            if (corridors?.length) break
          }
        } catch { /* continuar */ }
      }
    }
  }

  // ── Construir platos ──────────────────────────────────────────────────────
  let dishes: ExtractedDish[] = []

  if (corridors?.length) {
    dishes = corridorsToDishes(corridors)
  }

  // Intento 4: JSON-LD
  if (!dishes.length && html) {
    dishes = extractDishesFromJsonLd(html)
  }

  // Intento 5: parseo de scripts inline del HTML renderizado
  if (!dishes.length && html) {
    dishes = extractDishesFromRenderedHtml(html)
  }

  if (!dishes.length) {
    throw new Error(
      'No se pudo extraer el menú de Rappi — la página carga vía JavaScript dinámico. ' +
      'Prueba con otra URL del local (UberEats, PedidosYa) o sube la carta manualmente.'
    )
  }

  const bannerMatch = html.match(/property="og:image" content="([^"]+)"/)
  const bannerUrl = bannerMatch ? bannerMatch[1] : null

  return { restaurantName: '', dishes, logoUrl: null, bannerUrl }
}
