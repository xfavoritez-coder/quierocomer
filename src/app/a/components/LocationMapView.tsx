'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function FlyToCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.5 })
  }, [map, lat, lng])
  return null
}

export default function LocationMapView({
  lat, lng, onDragEnd,
}: {
  lat: number
  lng: number
  onDragEnd: (lat: number, lng: number) => void
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToCenter lat={lat} lng={lng} />
      <Marker
        position={[lat, lng]}
        draggable={true}
        eventHandlers={{
          dragend: (e) => {
            const pos = e.target.getLatLng()
            onDragEnd(pos.lat, pos.lng)
          },
        }}
      />
    </MapContainer>
  )
}
