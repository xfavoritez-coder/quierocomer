import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('placeId')
  if (!placeId) return NextResponse.json({ phone: null })

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return NextResponse.json({ phone: null })

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`
    const res = await fetch(url, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'nationalPhoneNumber,internationalPhoneNumber' },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return NextResponse.json({ phone: null })
    const data = await res.json() as { nationalPhoneNumber?: string; internationalPhoneNumber?: string }
    const phone = data.internationalPhoneNumber ?? data.nationalPhoneNumber ?? null
    return NextResponse.json({ phone }, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return NextResponse.json({ phone: null })
  }
}
