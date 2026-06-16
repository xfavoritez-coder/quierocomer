import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — obtener todos los prospectos
export async function GET() {
  const prospectos = await prisma.mapaProspecto.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(prospectos)
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

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
}

// DELETE — eliminar por id (?id=xxx) o todos (?all=1)
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('all') === '1') {
    await prisma.mapaProspecto.deleteMany()
    return NextResponse.json({ ok: true })
  }
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.mapaProspecto.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
