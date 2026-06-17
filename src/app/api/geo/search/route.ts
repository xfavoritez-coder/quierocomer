import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY

/** Server-side geocoding proxy using Google Geocoding API.
 *  Más preciso que Nominatim para direcciones en Chile.
 *  GET /api/geo/search?q=<address>
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 3) return NextResponse.json([])

  if (!GOOGLE_KEY) {
    // Fallback a Nominatim si no hay key (no debería pasar en prod)
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

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q + ', Chile')}&region=cl&language=es&key=${GOOGLE_KEY}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.length) return NextResponse.json([])

    const results = data.results.slice(0, 6).map((r: any) => ({
      place_id: r.place_id,
      display_name: r.formatted_address,
      lat: String(r.geometry.location.lat),
      lon: String(r.geometry.location.lng),
      address: parseGoogleComponents(r.address_components),
    }))

    return NextResponse.json(results)
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
