'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapRestaurant = {
  id: string
  name: string
  slug: string
  lat: number
  lng: number
  logo: string | null
  googleRating: number | null
  googleRatingCount: number | null
  dishes: { id: string; name: string; fotoUrl: string | null; precio: number; categoria: string }[]
}

type Props = {
  restaurants: MapRestaurant[]
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void
  onRestaurantClick: (r: MapRestaurant) => void
}

export default function LeafletMap({ restaurants, onBoundsChange, onRestaurantClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [-33.4489, -70.6693],
      zoom: 12,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const emitBounds = () => {
      const b = map.getBounds()
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      })
    }

    map.on('moveend', emitBounds)
    map.on('zoomend', emitBounds)

    mapRef.current = map

    // Emit initial bounds after tiles load
    map.once('load', emitBounds)
    // Fallback: emit after a short tick in case 'load' already fired
    setTimeout(emitBounds, 300)

    return () => {
      map.off('moveend', emitBounds)
      map.off('zoomend', emitBounds)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update markers when restaurants change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    restaurants.forEach((r) => {
      const logoHtml = r.logo
        ? `<img src="${r.logo}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=\\'font-size:18px\\'>🍽</span>'"/>`
        : '<span style="font-size:18px">🍽</span>'

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;border-radius:50%;border:2.5px solid #F4A623;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:pointer">${logoHtml}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      })

      const ratingText = r.googleRating ? `⭐ ${r.googleRating.toFixed(1)}` : '⭐ –'
      const marker = L.marker([r.lat, r.lng], { icon })
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;min-width:140px">
            <b style="font-size:14px">${r.name}</b><br/>
            <span style="font-size:12px;color:#666">${ratingText} · ${r.dishes.length} platos</span>
          </div>`,
          { offset: [0, -4] }
        )
        .addTo(map)

      marker.on('click', () => {
        onRestaurantClick(r)
      })

      markersRef.current.push(marker)
    })
  }, [restaurants, onRestaurantClick])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
