import type { ExtractionResult, ExtractedDish } from './types'

function decodeHtml(str: string): string {
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .trim()
}

function stripHtml(str: string): string {
  return decodeHtml(str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

export async function extractWooCommerce(url: string): Promise<ExtractionResult> {
  const baseUrl = new URL(url).origin

  // Fetch all products paginating
  const products: any[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${baseUrl}/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuieroComer/1.0)' }, signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) break
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    products.push(...data)
    if (data.length < 100) break
    page++
  }

  if (products.length === 0) throw new Error('No se encontraron productos en la tienda WooCommerce')

  const dishes: ExtractedDish[] = products
    .filter(p => p.type === 'simple' || !p.type)
    .map(p => {
      const catName = p.categories?.[0]?.name ? decodeHtml(p.categories[0].name) : 'General'
      const price = parseInt(p.prices?.price ?? '0', 10)
      const imageUrl = p.images?.[0]?.src ?? null
      const description = p.short_description ? stripHtml(p.short_description) : (p.description ? stripHtml(p.description) : '')
      return {
        name: decodeHtml(p.name),
        description,
        price,
        imageUrl,
        photoCredit: null,
        category: catName,
        diet: 'OMNIVORE' as const,
        isSpicy: false,
      }
    })

  console.log(`[WooCommerce] Extracted: ${dishes.length} dishes from ${baseUrl}`)
  return { restaurantName: '', dishes, logoUrl: null, bannerUrl: null }
}

/** Check if a URL belongs to a WooCommerce store */
export async function isWooCommerce(url: string): Promise<boolean> {
  try {
    const baseUrl = new URL(url).origin
    const res = await fetch(`${baseUrl}/wp-json/wc/store/v1/products?per_page=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuieroComer/1.0)' },
      signal: AbortSignal.timeout(6000),
    })
    return res.ok
  } catch {
    return false
  }
}
