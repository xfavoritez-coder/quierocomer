// src/lib/google-places.ts
// Uses Places API (New) — v1 endpoint, legacy API is disabled for this project
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export type PlaceInfo = {
  placeId: string
  mapsUrl: string
  rating: number | null
  ratingCount: number | null
}

export async function findPlaceInfo(name: string, lat: number, lng: number): Promise<PlaceInfo | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri',
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 500, // 500m — narrow radius to get the right place
        },
      },
      maxResultCount: 1,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()

  const place = data.places?.[0]
  if (!place) return null

  return {
    placeId: place.id,
    mapsUrl: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
  }
}
