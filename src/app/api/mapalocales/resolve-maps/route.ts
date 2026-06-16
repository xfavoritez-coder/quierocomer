import { NextRequest, NextResponse } from 'next/server'

// POST { mapsUrl } → { name, address, lat, lng, placeId?, mapsUrl, googleMapsUrl?, rating?, reviews?, website? }
// Accepts: Google Maps URL, UberEats URL, Rappi URL, or any other URL (extracts name from slug)
export async function POST(req: NextRequest) {
  const { mapsUrl } = await req.json() as { mapsUrl: string }
  if (!mapsUrl?.trim()) return NextResponse.json({ error: 'URL requerida' }, { status: 400 })

  const url = mapsUrl.trim()
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  // ── Helper: Google Places textSearch by name (no coordinates needed) ──────
  async function searchByName(name: string, lat?: number | null, lng?: number | null) {
    if (!apiKey || !name) return null
    try {
      const body: any = {
        textQuery: name + ' restaurante Chile',
        languageCode: 'es',
      }
      if (lat && lng) {
        body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 300 } }
      } else {
        body.locationBias = { circle: { center: { latitude: -33.45, longitude: -70.65 }, radius: 50000 } }
      }
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.regularOpeningHours',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      const data = await res.json() as { places?: any[] }
      const place = data.places?.[0]
      if (!place) return null
      return {
        name: place.displayName?.text ?? name,
        address: place.formattedAddress ?? '',
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        placeId: place.id ?? null,
        googleMapsUrl: place.googleMapsUri ?? null,
        rating: place.rating ?? null,
        reviews: place.userRatingCount ?? null,
        website: place.websiteUri ?? null,
        phone: place.nationalPhoneNumber ?? null,
        openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
      }
    } catch { return null }
  }

  // ── Delivery platform URL: extract name from slug ─────────────────────────
  const isGoogleMaps = url.includes('maps.google') || url.includes('maps.app.goo.gl') || url.includes('google.com/maps')

  if (!isGoogleMaps) {
    let extractedName = ''

    // UberEats: https://www.ubereats.com/cl/store/restaurant-name-here/HASH
    const ueMatch = url.match(/ubereats\.com\/[a-z]{2}\/store\/([^/?#]+)/)
    if (ueMatch) {
      extractedName = ueMatch[1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\s+[A-Z0-9]{10,}$/, '')
        .trim()
    }

    // Rappi: https://www.rappi.cl/restaurantes/900111529-el-bajon-express
    if (!extractedName) {
      const rappiMatch = url.match(/rappi\.[a-z]+\/restaurantes\/\d+-(.+?)(?:\/|\?|$)/)
      if (rappiMatch) {
        extractedName = rappiMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim()
      }
    }

    // PedidosYa: https://www.pedidosya.cl/restaurantes/santiago/restaurant-name-menu
    if (!extractedName) {
      const pyMatch = url.match(/pedidosya\.cl\/restaurantes\/[^/]+\/(.+?)(?:-menu)?(?:\/|\?|$)/)
      if (pyMatch) {
        extractedName = pyMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim()
      }
    }

    // Generic: try to extract from last path segment
    if (!extractedName) {
      try {
        const u = new URL(url)
        const lastSegment = u.pathname.split('/').filter(Boolean).pop() ?? ''
        if (lastSegment && !lastSegment.match(/^[A-Z0-9]{8,}$/)) {
          extractedName = lastSegment
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim()
        }
      } catch {}
    }

    const found = await searchByName(extractedName)
    if (found) {
      return NextResponse.json({
        name: found.name,
        address: found.address,
        lat: found.lat,
        lng: found.lng,
        placeId: found.placeId,
        mapsUrl: found.googleMapsUrl ?? url,
        googleMapsUrl: found.googleMapsUrl,
        rating: found.rating,
        reviews: found.reviews,
        website: found.website,
        phone: found.phone,
        openingHours: found.openingHours,
      })
    }

    return NextResponse.json({
      name: extractedName || url,
      address: '',
      lat: null,
      lng: null,
      placeId: null,
      mapsUrl: url,
      googleMapsUrl: null,
      rating: null,
      reviews: null,
      website: null,
      phone: null,
      openingHours: null,
    })
  }

  // ── Google Maps URL flow ──────────────────────────────────────────────────
  try {
    // Must use GET (not HEAD) and a browser User-Agent — Google ignores HEAD from servers
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })
    const finalUrl = res.url

    const namePath = finalUrl.match(/\/maps\/place\/([^/@?]+)/)?.[1]
    const nameFromUrl = namePath ? decodeURIComponent(namePath.replace(/\+/g, ' ')) : ''

    const coordMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const lat = coordMatch ? parseFloat(coordMatch[1]) : null
    const lng = coordMatch ? parseFloat(coordMatch[2]) : null

    if (!lat || !lng) {
      const fallbackUrl = finalUrl || url
      return NextResponse.json({
        name: nameFromUrl,
        address: '',
        lat: null,
        lng: null,
        placeId: null,
        mapsUrl: fallbackUrl,
        googleMapsUrl: null,
        rating: null,
        reviews: null,
        website: null,
        phone: null,
        openingHours: null,
      })
    }

    if (apiKey && nameFromUrl) {
      const found = await searchByName(nameFromUrl, lat, lng)
      if (found) {
        const bestUrl = found.googleMapsUrl ?? finalUrl
        return NextResponse.json({
          name: found.name,
          address: found.address,
          lat: found.lat ?? lat,
          lng: found.lng ?? lng,
          placeId: found.placeId,
          mapsUrl: bestUrl,
          googleMapsUrl: found.googleMapsUrl,
          rating: found.rating,
          reviews: found.reviews,
          website: found.website,
          phone: found.phone,
          openingHours: found.openingHours,
        })
      }
    }

    const fallbackUrl = finalUrl || url
    return NextResponse.json({
      name: nameFromUrl,
      address: '',
      lat,
      lng,
      placeId: null,
      mapsUrl: fallbackUrl,
      googleMapsUrl: null,
      rating: null,
      reviews: null,
      website: null,
      phone: null,
      openingHours: null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error resolviendo URL' }, { status: 500 })
  }
}
