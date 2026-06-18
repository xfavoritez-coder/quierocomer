import { NextRequest } from 'next/server'
import { importFromProspecto } from '@/lib/extractors/pipeline'
import { prisma } from '@/lib/prisma'
import { normalizeCategoryWithRestaurant, isValidQcCategory, isExcludedCategory } from '@/app/a/lib/categories'

export const maxDuration = 300

// Providers we can extract from (all others skip)
const EXTRACTABLE = new Set([
  'Justo', 'OlaClick', 'UberEats', 'Fudo', 'Mercat', 'Gourmedia',
  'Rappi', 'Queresto', 'Web propia', 'Toteat', 'InfluyeApp',
  // PedidosYa: bloqueado con 403 + CAPTCHA, no se puede extraer automáticamente
])

type ProspectoInput = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  mapsUrl: string
  cartaUrl: string
  provider: string | null
}

export async function POST(req: NextRequest) {
  const { prospectos } = (await req.json()) as { prospectos: ProspectoInput[] }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  function send(data: object) {
    writer.write(encoder.encode(JSON.stringify(data) + '\n'))
  }

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms / 1000}s) — ${label}`)), ms)),
    ])
  }

  ;(async () => {
    try {
      const toProcess = prospectos.filter(p => p.cartaUrl && (p.provider === null || EXTRACTABLE.has(p.provider)))

      send({ type: 'total', total: toProcess.length })

      let ok = 0
      let failed = 0

      for (let i = 0; i < toProcess.length; i++) {
        const p = toProcess[i]
        send({ type: 'progress', current: i + 1, id: p.id, name: p.name })

        try {
          const result = await withTimeout(
            importFromProspecto({
              prospectoId: p.id,
              name: p.name,
              address: p.address,
              lat: p.lat,
              lng: p.lng,
              mapsUrl: p.mapsUrl,
              cartaUrl: p.cartaUrl,
              providerName: p.provider,
              onProgress: (type, data) => send({ type, id: p.id, ...data }),
            }),
            150_000,
            p.name,
          )
          ok++
          // Check for unmapped categories
          const cats = await prisma.category.findMany({
            where: { restaurant: { slug: result.slug }, dishes: { some: { isActive: true, photos: { isEmpty: false } } } },
            select: { name: true },
          })
          const unmapped = cats
            .map(c => c.name.trim())
            .filter(n => !isValidQcCategory(normalizeCategoryWithRestaurant(n, p.name)) && !isExcludedCategory(n))
          send({ type: 'result', id: p.id, slug: result.slug, dishCount: result.dishCount, status: 'ok', unmappedCategories: unmapped.length > 0 ? unmapped : undefined })
        } catch (e: any) {
          failed++
          send({ type: 'result', id: p.id, status: 'error', error: e?.message ?? 'Error desconocido' })
        }
      }

      send({ type: 'done', ok, failed })
    } catch (e: any) {
      send({ type: 'done', ok: 0, failed: 0 })
    } finally {
      writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
