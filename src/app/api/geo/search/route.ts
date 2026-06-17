import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY

/** Server-side geocoding proxy.
 *  Usa Google Places Autocomplete para sugerencias mientras el usuario escribe,
 *  luego resuelve coordenadas con Geocoding por place_id en paralelo.
 *  Fallback a Nominatim si no hay key de Google.
 *  GET /api/geo/search?q=<address>
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 3) return NextResponse.json([])

  if (!GOOGLE_KEY) {
    return nominatimSearch(q)
  }

  try {
    // 1. Places Autocomplete — optimizado para texto parcial
    const acUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&language=es&components=country:cl&types=geocode&key=${GOOGLE_KEY}`
    const acRes = await fetch(acUrl, { next: { revalidate: 0 } })
    const acData = await acRes.json()

    if (acData.status !== 'OK' || !acData.predictions?.length) {
      return nominatimSearch(q)
    }

    const predictions: { place_id: string; description: string }[] = acData.predictions.slice(0, 6)

    // 2. Geocoding por place_id en paralelo para obtener coordenadas
    const results = await Promise.all(
      predictions.map(async (pred) => {
        try {
          const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${pred.place_id}&language=es&key=${GOOGLE_KEY}`
          const geoRes = await fetch(geoUrl, { next: { revalidate: 0 } })
          const geoData = await geoRes.json()

          if (geoData.status !== 'OK' || !geoData.results?.[0]) {
            return {
              place_id: pred.place_id,
              display_name: pred.description,
              lat: '0',
              lon: '0',
              address: {},
            }
          }

          const r = geoData.results[0]
          return {
            place_id: pred.place_id,
            display_name: pred.description,
            lat: String(r.geometry.location.lat),
            lon: String(r.geometry.location.lng),
            address: parseGoogleComponents(r.address_components),
          }
        } catch {
          return {
            place_id: pred.place_id,
            display_name: pred.description,
            lat: '0',
            lon: '0',
            address: {},
          }
        }
      })
    )

    return NextResponse.json(results.filter((r) => r.lat !== '0'))
  } catch {
    return nominatimSearch(q)
  }
}

async function nominatimSearch(q: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=cl`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'QuieroComer/1.0' } }
    )
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json([])
  }
}

function parseGoogleComponents(components: any[]): Record<string, string> {
  const addr: Record<string, string> = {}
  for (const c of components) {
    if (c.types.includes('route')) addr.road = c.long_name
    if (c.types.includes('street_number')) addr.house_number = c.long_name
    if (c.types.includes('locality')) addr.city = c.long_name
    if (c.types.includes('administrative_area_level_1')) addr.state = c.long_name
    if (c.types.includes('country')) addr.country = c.long_name
    if (c.types.includes('sublocality_level_1') || c.types.includes('sublocality')) addr.suburb = c.long_name
  }
  return addr
}
