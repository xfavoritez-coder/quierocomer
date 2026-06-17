import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY

/** Retorna coordenadas y dirección para un place_id de Google Places.
 *  Se llama solo cuando el usuario selecciona una sugerencia.
 *  GET /api/geo/place?place_id=<id>
 */
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id')?.trim()
  if (!placeId || !GOOGLE_KEY) return NextResponse.json(null)

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&language=es&key=${GOOGLE_KEY}`
    const res = await fetch(url, { next: { revalidate: 86400 } }) // cacheable: un lugar no cambia de coords
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.[0]) return NextResponse.json(null)

    const r = data.results[0]
    return NextResponse.json({
      lat: String(r.geometry.location.lat),
      lon: String(r.geometry.location.lng),
      display_name: r.formatted_address,
      address: parseGoogleComponents(r.address_components),
    })
  } catch {
    return NextResponse.json(null)
  }
}

function parseGoogleComponents(components: any[]): Record<string, string> {
  const addr: Record<string, string> = {}
  for (const c of components) {
    if (c.types.includes('route')) addr.road = c.long_name
    if (c.types.includes('street_number')) addr.house_number = c.long_name
    if (c.types.includes('locality')) addr.city = c.long_name
    if (c.types.includes('sublocality_level_1') || c.types.includes('sublocality')) addr.suburb = c.long_name
  }
  return addr
}
