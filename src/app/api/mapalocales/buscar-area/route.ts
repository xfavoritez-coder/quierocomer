import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export type PlaceResult = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  mapsUrl: string
  website: string | null
  rating: number | null
  reviews: number | null
}

// Ray-casting point-in-polygon
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function centroid(poly: [number, number][]): [number, number] {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]
}

function haversineMeters(p1: [number, number], p2: [number, number]): number {
  const R = 6371000
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
  const { polygon } = (await req.json()) as { polygon: [number, number][] }

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  function send(data: object) {
    writer.write(encoder.encode(JSON.stringify(data) + '\n'))
  }

  ;(async () => {
    try {
      if (!polygon || polygon.length < 3) {
        send({ type: 'error', message: 'Se necesitan al menos 3 puntos para definir el área' })
        return
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY
      if (!apiKey) {
        send({ type: 'error', message: 'GOOGLE_PLACES_API_KEY no está configurada en el servidor' })
        return
      }

      // Bounding box del polígono
      const lats = polygon.map(p => p[0])
      const lngs = polygon.map(p => p[1])
      const minLat = Math.min(...lats), maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

      // Radio total para estimar tamaño del área
      const center = centroid(polygon)
      const totalRadius = Math.max(...polygon.map(p => haversineMeters(center, p)))

      // Grilla adaptativa según tamaño: más grande → más celdas
      const gridN = totalRadius < 1500 ? 1 : totalRadius < 4000 ? 2 : totalRadius < 10000 ? 3 : 4
      const totalCells = gridN * gridN

      const latStep = (maxLat - minLat) / gridN
      const lngStep = (maxLng - minLng) / gridN

      // Radio de cada celda = diagonal / 2 con 20% de solapamiento
      const cellRadius = Math.min(
        haversineMeters([minLat, minLng], [minLat + latStep, minLng + lngStep]) / 2 * 1.2,
        50000,
      )

      const areaKm = (totalRadius / 1000).toFixed(1)
      send({ type: 'status', message: `Área ~${areaKm} km de radio — dividiendo en grilla ${gridN}×${gridN} (${totalCells} zona${totalCells !== 1 ? 's' : ''})` })

      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus',
      }

      // Buscar por tipo separado para superar el límite de 20 por request
      // Todos los tipos de comida de la API de Google Places (Table A)
      // Se buscan por separado porque el límite es 20 resultados por tipo.
      // Tipos de cocina específicos a veces NO están etiquetados como "restaurant" genérico.
      const PLACE_TYPES = [
        // Generales (capturan la mayoría)
        'restaurant',
        'cafe',
        'coffee_shop',
        'bar',
        'bakery',
        'fast_food_restaurant',
        'meal_takeaway',
        'meal_delivery',
        // Dieta especial (frecuentemente NO tienen tipo "restaurant")
        'vegan_restaurant',
        'vegetarian_restaurant',
        // Cocinas específicas (pueden no tener tipo "restaurant")
        'sushi_restaurant',
        'japanese_restaurant',
        'chinese_restaurant',
        'korean_restaurant',
        'thai_restaurant',
        'vietnamese_restaurant',
        'indian_restaurant',
        'indonesian_restaurant',
        'middle_eastern_restaurant',
        'lebanese_restaurant',
        'turkish_restaurant',
        'greek_restaurant',
        'mediterranean_restaurant',
        'italian_restaurant',
        'french_restaurant',
        'spanish_restaurant',
        'american_restaurant',
        'mexican_restaurant',
        'brazilian_restaurant',
        'pizza_restaurant',
        'hamburger_restaurant',
        'barbecue_restaurant',
        'seafood_restaurant',
        'steak_house',
        'ramen_restaurant',
        'sandwich_shop',
        // Postres y bebidas
        'ice_cream_shop',
        'wine_bar',
        // Horario específico
        'breakfast_restaurant',
        'brunch_restaurant',
      ]

      // Cargar IDs ya existentes para no mostrar locales que ya tenemos
      const [existingRestaurants, existingProspectos] = await Promise.all([
        prisma.restaurant.findMany({
          where: { isActive: true, isDemo: false, googlePlaceId: { not: null } },
          select: { googlePlaceId: true },
        }),
        prisma.mapaProspecto.findMany({
          where: { OR: [{ importedSlug: { not: null } }, { dismissed: true }] },
          select: { id: true },
        }),
      ])
      const importedPlaceIds = new Set([
        ...existingRestaurants.map(r => r.googlePlaceId!),
        ...existingProspectos.map(p => p.id),
      ])

      const seenIds = new Set<string>()
      let totalFound = 0

      for (let i = 0; i < gridN; i++) {
        for (let j = 0; j < gridN; j++) {
          const cellLat = minLat + latStep * (i + 0.5)
          const cellLng = minLng + lngStep * (j + 0.5)
          const cellNum = i * gridN + j + 1

          send({ type: 'status', message: `Buscando en zona ${cellNum}/${totalCells}...` })

          let newInCell = 0

          for (const placeType of PLACE_TYPES) {
            const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                includedTypes: [placeType],
                excludedTypes: ['general_store', 'convenience_store', 'grocery_store', 'supermarket', 'liquor_store'],
                locationRestriction: {
                  circle: { center: { latitude: cellLat, longitude: cellLng }, radius: cellRadius },
                },
                maxResultCount: 20,
                rankPreference: 'DISTANCE',
                languageCode: 'es',
              }),
            })

            if (!res.ok) {
              const errText = await res.text()
              let msg = `Error en zona ${cellNum}/${placeType} (${res.status})`
              try { msg = JSON.parse(errText)?.error?.message ?? msg } catch {}
              send({ type: 'status', message: `⚠ ${msg}` })
              continue
            }

            const json = (await res.json()) as { places?: any[]; error?: any }
            if (json.error) {
              send({ type: 'status', message: `⚠ ${json.error.message}` })
              continue
            }

            for (const p of json.places ?? []) {
              if (seenIds.has(p.id)) continue
              if (importedPlaceIds.has(p.id)) continue
              if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue
              const lat = p.location?.latitude
              const lng = p.location?.longitude
              if (!lat || !lng || !pointInPolygon([lat, lng], polygon)) continue

              seenIds.add(p.id)
              totalFound++
              newInCell++
              send({
                type: 'place',
                place: {
                  id: p.id ?? '',
                  name: p.displayName?.text ?? '',
                  address: p.formattedAddress ?? '',
                  lat,
                  lng,
                  mapsUrl: p.googleMapsUri ?? '',
                  website: p.websiteUri ?? null,
                  rating: p.rating ?? null,
                  reviews: p.userRatingCount ?? null,
                } satisfies PlaceResult,
              })
            }

            // Pausa breve entre tipos para no saturar la API
            await new Promise(r => setTimeout(r, 100))
          }

          if (totalCells > 1) {
            send({ type: 'status', message: `Zona ${cellNum}: ${newInCell} nuevo${newInCell !== 1 ? 's' : ''} — total acumulado: ${totalFound}` })
          }

          if (cellNum < totalCells) await new Promise(r => setTimeout(r, 200))
        }
      }

      if (totalFound === 0) {
        send({ type: 'status', message: 'No se encontraron locales operativos en el área. Prueba agrandando la zona.' })
      }

      send({ type: 'done', total: totalFound })
    } catch (e: any) {
      send({ type: 'error', message: e?.message ?? 'Error inesperado' })
    } finally {
      writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
