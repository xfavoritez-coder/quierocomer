import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY

/** Sugerencias de autocomplete mientras el usuario escribe.
 *  Solo retorna place_id + texto — sin coordenadas (se cargan al hacer click).
 *  GET /api/geo/search?q=<texto parcial>
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  // ?all=1 → sin restricción de país (por defecto se limita a Chile)
  const noCountry = req.nextUrl.searchParams.get('all') === '1'
  if (!q || q.length < 3) return NextResponse.json([])

  if (!GOOGLE_KEY) {
    return nominatimSearch(q, noCountry)
  }

  try {
    const countryParam = noCountry ? '' : '&components=country:cl'
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&language=es${countryParam}&types=geocode&key=${GOOGLE_KEY}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    const data = await res.json()

    if (data.status !== 'OK' || !data.predictions?.length) {
      return nominatimSearch(q, noCountry)
    }

    const results = data.predictions.slice(0, 6).map((p: any) => ({
      place_id: p.place_id,
      display_name: p.description,
      lat: '0',
      lon: '0',
      address: {},
    }))

    return NextResponse.json(results)
  } catch {
    return nominatimSearch(q, noCountry)
  }
}

async function nominatimSearch(q: string, noCountry = false) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6${noCountry ? '' : '&countrycodes=cl'}`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'QuieroComer/1.0' } }
    )
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json([])
  }
}
