'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapRestaurant } from './MapaClient'

type Props = {
  restaurants: MapRestaurant[]
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void
  onRestaurantClick: (r: MapRestaurant) => void
  isDark: boolean
  locateRef?: React.RefObject<((onDone?: () => void) => void) | null>
  flyToRef?: React.RefObject<((lat: number, lng: number, zoom?: number) => void) | null>
  userLocation?: { lat: number; lng: number } | null
  userLocationLabel?: string | null
}

const normalStyle: L.CircleMarkerOptions = {
  radius: 7, fillColor: '#F4A623', color: 'rgba(255,255,255,0.4)',
  weight: 2, opacity: 1, fillOpacity: 1,
}
const selectedStyle: L.CircleMarkerOptions = {
  radius: 10, fillColor: '#e09200', color: '#ffffff',
  weight: 2.5, opacity: 1, fillOpacity: 1,
}

function buildPopupHtml(r: MapRestaurant, isDark: boolean): string {
  const bg = isDark ? '#1a1a1a' : '#fff'
  const textColor = isDark ? '#fff' : '#111'
  const subColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'
  const border = isDark ? 'none' : '1px solid rgba(0,0,0,0.08)'

  const fallbackLetter = `<div style="width:36px;height:36px;border-radius:8px;background:rgba(244,166,35,0.15);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#F4A623">${r.name[0].toUpperCase()}</div>`
  const logoHtml = r.logo
    ? `<div style="position:relative;width:36px;height:36px;flex-shrink:0">
         ${fallbackLetter}
         <img src="${r.logo}" style="position:absolute;inset:0;width:36px;height:36px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'"/>
       </div>`
    : `<div style="flex-shrink:0">${fallbackLetter}</div>`

  function dietaTag(d: MapRestaurant['dishes'][0]): string {
    if (!d.dieta) return ''
    const tags: string[] = []
    if (d.dieta.tipo === 'VEGAN') tags.push('<span style="font-size:9px;background:rgba(76,175,80,0.15);color:#388E3C;border-radius:4px;padding:1px 5px;font-weight:600">🌱 Vegano</span>')
    else if (d.dieta.tipo === 'VEGETARIAN') tags.push('<span style="font-size:9px;background:rgba(76,175,80,0.15);color:#388E3C;border-radius:4px;padding:1px 5px;font-weight:600">🥦 Veggie</span>')
    if (d.dieta.esPicante) tags.push('<span style="font-size:9px;background:rgba(244,67,54,0.12);color:#D32F2F;border-radius:4px;padding:1px 5px;font-weight:600">🌶 Picante</span>')
    return tags.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px">${tags.join('')}</div>` : ''
  }

  const dishPhotos = r.dishes.filter(d => d.fotoUrl).slice(0, 3)
  const fotosHtml = dishPhotos.length > 0
    ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:10px">
        ${dishPhotos.map(d => `<div style="position:relative;cursor:pointer" onclick="window.__qcDishClick&&window.__qcDishClick('${d.id}')">
          <img src="${d.fotoUrl}" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;display:block">
          ${dietaTag(d)}
        </div>`).join('')}
       </div>`
    : ''

  return `
    <div style="background:${bg};border-radius:14px;padding:14px;min-width:200px;max-width:240px;color:${textColor};font-family:system-ui,sans-serif;border:${border}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        ${logoHtml}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
          <div style="font-size:11px;color:${subColor};margin-top:1px">
            ${r.googleRating ? `⭐ ${r.googleRating.toFixed(1)}` : ''} · ${r.dishes.length} platos
          </div>
        </div>
      </div>
      ${fotosHtml}
    </div>
  `
}

export default function LeafletMap({ restaurants, onBoundsChange, onRestaurantClick, isDark, locateRef, flyToRef, userLocation, userLocationLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])
  const activeIdRef = useRef<string | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const userMarkerRef = useRef<L.CircleMarker | null>(null)
  const userLocationLabelRef = useRef(userLocationLabel)
  useEffect(() => { userLocationLabelRef.current = userLocationLabel }, [userLocationLabel])
  const isDarkRef = useRef(isDark)
  useEffect(() => { isDarkRef.current = isDark }, [isDark])

  // Swap tile layer when isDark changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tileLayerRef.current?.remove()
    const url = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    tileLayerRef.current = L.tileLayer(url, {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map)
  }, [isDark])

  function addUserMarker(map: L.Map, lat: number, lng: number) {
    const marker = L.circleMarker([lat, lng], {
      radius: 8, fillColor: '#4A90E2', color: '#fff',
      weight: 2.5, opacity: 1, fillOpacity: 1,
    }).addTo(map)
    marker.on('click', () => {
      const label = userLocationLabelRef.current || 'Tu ubicación'
      const popup = L.popup({ closeButton: false, className: 'qc-mapa-popup', offset: [0, -8] })
        .setContent(`<div style="padding:10px 14px;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;white-space:nowrap">📍 ${label}</div>`)
      marker.bindPopup(popup).openPopup()
    })
    return marker
  }

  // Desplaza un punto geográfico hacia abajo en píxeles para compensar el bottom sheet
  // El sheet cubre ~200px → subimos el punto visible 100px (la mitad del sheet)
  const SHEET_OFFSET_PX = 125
  function centerWithSheet(map: L.Map, lat: number, lng: number, zoom: number): L.LatLng {
    const px = map.project([lat, lng], zoom)
    return map.unproject(L.point(px.x, px.y + SHEET_OFFSET_PX), zoom)
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const rawCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [-33.4470, -70.6270]
    const INIT_ZOOM = 14
    const map = L.map(containerRef.current, { center: rawCenter, zoom: INIT_ZOOM })
    mapRef.current = map

    // Ajustar centro para que el punto quede en el área visible (sobre el sheet)
    map.setView(centerWithSheet(map, rawCenter[0], rawCenter[1], INIT_ZOOM), INIT_ZOOM, { animate: false })

    // Si hay ubicación activa, mostrar punto azul desde el inicio
    if (userLocation) {
      userMarkerRef.current = addUserMarker(map, userLocation.lat, userLocation.lng)
    }

    const url = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    tileLayerRef.current = L.tileLayer(url, {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map)

    const emitBounds = () => {
      const b = map.getBounds()
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
    }
    map.on('moveend', emitBounds)
    map.on('zoomend', emitBounds)
    setTimeout(emitBounds, 300)

    // Expose locate function via ref
    if (locateRef) {
      locateRef.current = (onDone?: () => void) => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude: lat, longitude: lng } = pos.coords
            const zoom = 15
            map.flyTo(centerWithSheet(map, lat, lng, zoom), zoom, { animate: true, duration: 1 })
            userMarkerRef.current?.remove()
            userMarkerRef.current = addUserMarker(map, lat, lng)
            onDone?.()
          },
          () => { onDone?.() },
          { enableHighAccuracy: true, timeout: 8000 }
        )
      }
    }

    // Expose flyTo function via ref
    if (flyToRef) {
      flyToRef.current = (lat, lng, zoom = 15) =>
        map.flyTo(centerWithSheet(map, lat, lng, zoom), zoom, { animate: true, duration: 1 })
    }

    return () => {
      map.remove()
      mapRef.current = null
      userMarkerRef.current = null
      if (locateRef) locateRef.current = null
      if (flyToRef) flyToRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update user location marker when prop changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    userMarkerRef.current?.remove()
    userMarkerRef.current = null
    if (userLocation) {
      userMarkerRef.current = addUserMarker(map, userLocation.lat, userLocation.lng)
    }
  }, [userLocation])

  // Update markers when restaurants change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    activeIdRef.current = null

    restaurants.forEach(r => {
      const circle = L.circleMarker([r.lat, r.lng], normalStyle)

      const popup = L.popup({
        closeButton: false,
        className: 'qc-mapa-popup',
        maxWidth: 260,
        offset: [0, -8],
      }).setContent(buildPopupHtml(r, isDarkRef.current))

      circle.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        if (activeIdRef.current && activeIdRef.current !== r.id) {
          const prev = markersRef.current.find(m => (m as L.CircleMarker & { _qcId?: string })._qcId === activeIdRef.current)
          if (prev) prev.setStyle(normalStyle)
        }
        activeIdRef.current = r.id
        ;(circle as L.CircleMarker & { _qcId?: string })._qcId = r.id
        circle.setStyle(selectedStyle)
        popup.setContent(buildPopupHtml(r, isDarkRef.current))
        circle.bindPopup(popup).openPopup()
        onRestaurantClick(r)
      })

      popup.on('remove', () => {
        if (activeIdRef.current === r.id) {
          circle.setStyle(normalStyle)
          activeIdRef.current = null
        }
      })

      ;(circle as L.CircleMarker & { _qcId?: string })._qcId = r.id
      circle.addTo(map)
      markersRef.current.push(circle)
    })
  }, [restaurants, onRestaurantClick])

  const zoomBg = isDark ? '#1a1a1a' : '#fff'
  const zoomColor = isDark ? '#fff' : '#333'
  const zoomBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
  const zoomHover = isDark ? '#2a2a2a' : '#f5f4f1'
  const attrBg = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'
  const attrColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)'
  const popupBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'

  return (
    <>
      <style>{`
        .qc-mapa-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
          border-radius: 14px !important;
          padding: 0 !important;
          border: ${popupBorder};
        }
        .qc-mapa-popup .leaflet-popup-content { margin: 0 !important; }
        .qc-mapa-popup .leaflet-popup-tip-container { display: none; }
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: ${attrBg} !important;
          color: ${attrColor} !important;
        }
        .leaflet-control-attribution a { color: ${attrColor} !important; }
        .leaflet-control-zoom a {
          background: ${zoomBg} !important;
          color: ${zoomColor} !important;
          border-color: ${zoomBorder} !important;
        }
        .leaflet-control-zoom a:hover { background: ${zoomHover} !important; }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
