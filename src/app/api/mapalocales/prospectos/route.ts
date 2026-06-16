import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeCategory, isExcludedCategory, isValidQcCategory } from '@/app/a/lib/categories'

// GET — obtener prospectos no descartados, con unmappedCategories para los ya importados
export async function GET() {
  const prospectos = await prisma.mapaProspecto.findMany({
    where: { dismissed: false },
    orderBy: { createdAt: 'desc' },
  })

  // Para prospectos ya importados, calcular categorías sin mapear
  const importedSlugs = prospectos.map(p => p.importedSlug).filter(Boolean) as string[]
  let unmappedBySlug: Record<string, string[]> = {}

  if (importedSlugs.length > 0) {
    const cats = await prisma.category.findMany({
      where: {
        restaurant: { slug: { in: importedSlugs } },
        normOverride: null,
        dishes: { some: { isActive: true, deletedAt: null, photos: { isEmpty: false } } },
      },
      select: { name: true, restaurant: { select: { slug: true } } },
    })
    for (const cat of cats) {
      const slug = cat.restaurant.slug
      const norm = normalizeCategory(cat.name.trim())
      if (!isValidQcCategory(norm) && !isExcludedCategory(cat.name)) {
        if (!unmappedBySlug[slug]) unmappedBySlug[slug] = []
        if (!unmappedBySlug[slug].includes(cat.name)) unmappedBySlug[slug].push(cat.name)
      }
    }
  }

  const result = prospectos.map(p => ({
    ...p,
    unmappedCategories: p.importedSlug ? (unmappedBySlug[p.importedSlug] ?? []) : undefined,
  }))

  return NextResponse.json(result)
}

// POST — upsert uno o varios lugares (desde búsqueda en mapa o resultado de prospección)
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Upsert de resultado de prospección: { id, name, address, mapsUrl, status, provider, cartaUrl, fuenteMatch }
  if (body.result) {
    const { id, name, address, mapsUrl, status, provider, cartaUrl, fuenteMatch } = body.result
    const updated = await prisma.mapaProspecto.upsert({
      where: { id },
      create: { id, name: name ?? '', address: address ?? '', mapsUrl: mapsUrl ?? '', status, provider, cartaUrl, fuenteMatch },
      update: { status, provider, cartaUrl, fuenteMatch },
    })
    return NextResponse.json(updated)
  }

  // Batch upsert de resultados de prospección: { results: ProspectoResult[] }
  if (body.results) {
    const results = body.results as Array<{
      id: string; name: string; address: string; mapsUrl: string
      status: string; provider?: string; cartaUrl?: string; fuenteMatch?: string
    }>
    // Procesar en chunks para no saturar la conexión de Supabase
    const CHUNK = 50
    for (let i = 0; i < results.length; i += CHUNK) {
      const chunk = results.slice(i, i + CHUNK)
      await prisma.$transaction(
        chunk.map(r =>
          prisma.mapaProspecto.upsert({
            where: { id: r.id },
            create: { id: r.id, name: r.name ?? '', address: r.address ?? '', mapsUrl: r.mapsUrl ?? '', status: r.status, provider: r.provider, cartaUrl: r.cartaUrl, fuenteMatch: r.fuenteMatch },
            update: { status: r.status, provider: r.provider, cartaUrl: r.cartaUrl, fuenteMatch: r.fuenteMatch },
          })
        )
      )
    }
    return NextResponse.json({ ok: true, count: results.length })
  }

  // Upsert masivo de lugares desde búsqueda en mapa: { places: PlaceResult[] }
  if (body.places) {
    const places = body.places as Array<{
      id: string; name: string; address: string; lat: number; lng: number
      mapsUrl: string; website: string | null; rating: number | null; reviews: number | null
    }>
    await prisma.$transaction(
      places.map(p =>
        prisma.mapaProspecto.upsert({
          where: { id: p.id },
          create: {
            id: p.id, name: p.name, address: p.address,
            lat: p.lat, lng: p.lng, mapsUrl: p.mapsUrl,
            website: p.website, rating: p.rating, reviews: p.reviews,
          },
          update: {
            name: p.name, address: p.address,
            lat: p.lat, lng: p.lng, mapsUrl: p.mapsUrl,
            website: p.website, rating: p.rating, reviews: p.reviews,
          },
        })
      )
    )
    return NextResponse.json({ ok: true, count: places.length })
  }

  // Manual add: { manual: { id, name, address, lat, lng, mapsUrl, cartaUrl, provider } }
  if (body.manual) {
    const m = body.manual as {
      id: string; name: string; address: string; lat: number | null; lng: number | null
      mapsUrl: string; cartaUrl?: string; provider?: string
    }
    const row = await prisma.mapaProspecto.upsert({
      where: { id: m.id },
      create: {
        id: m.id, name: m.name, address: m.address ?? '',
        lat: m.lat ?? undefined, lng: m.lng ?? undefined,
        mapsUrl: m.mapsUrl,
        cartaUrl: m.cartaUrl, provider: m.provider,
        status: m.cartaUrl ? 'encontrado' : undefined,
        fuenteMatch: 'manual',
      },
      update: {
        name: m.name, address: m.address ?? '',
        lat: m.lat ?? undefined, lng: m.lng ?? undefined,
        mapsUrl: m.mapsUrl,
        cartaUrl: m.cartaUrl, provider: m.provider,
        status: m.cartaUrl ? 'encontrado' : undefined,
        fuenteMatch: 'manual',
      },
    })
    return NextResponse.json(row)
  }

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
}

// DELETE — marcar como dismissed (no borrar, para no volver a aparecer en búsquedas futuras)
// ?all=1 borra físicamente todo (reset completo)
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('all') === '1') {
    await prisma.mapaProspecto.deleteMany()
    return NextResponse.json({ ok: true })
  }
  const body = await req.json().catch(() => ({}))
  const ids: string[] = body.ids ?? []
  if (ids.length === 0) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })
  await prisma.mapaProspecto.updateMany({ where: { id: { in: ids } }, data: { dismissed: true } })
  return NextResponse.json({ ok: true, count: ids.length })
}
