'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { RestauranteMapaData, ProspectoMapaData } from './page'

interface Props {
  restaurantes: RestauranteMapaData[]
  prospectos: ProspectoMapaData[]
  drawMode: boolean
  onPointAdded: (pt: [number, number], total: number) => void
  onPolygonDblClick: () => void
}

const normalStyle: L.CircleMarkerOptions = {
  radius: 7,
  fillColor: '#ff7a3c',
  color: 'rgba(255,255,255,0.5)',
  weight: 2,
  opacity: 1,
  fillOpacity: 1,
}

const selectedStyle: L.CircleMarkerOptions = {
  radius: 10,
  fillColor: '#ff4c00',
  color: '#ffffff',
  weight: 2.5,
  opacity: 1,
  fillOpacity: 1,
}

const prospectoStyle: L.CircleMarkerOptions = {
  radius: 6,
  fillColor: '#888888',
  color: 'rgba(255,255,255,0.25)',
  weight: 1.5,
  opacity: 0.8,
  fillOpacity: 0.7,
}

function buildPopupHtml(r: RestauranteMapaData, fotos: string[] | null): string {
  const fotosHtml =
    fotos === null
      ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:10px">
          ${Array(6).fill(0).map(() => `<div style="aspect-ratio:1;border-radius:6px;background:rgba(255,255,255,0.06)"></div>`).join('')}
         </div>`
      : fotos.length === 0
        ? `<p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.3)">Sin fotos disponibles</p>`
        : `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:10px">
            ${fotos.map(src => `<img src="${src}" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;display:block">`).join('')}
           </div>`

  const logoHtml = r.logoUrl
    ? `<img src="${r.logoUrl}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0" />`
    : `<div style="width:36px;height:36px;border-radius:8px;background:rgba(255,76,0,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;color:#ff7a3c">${r.name[0].toUpperCase()}</div>`

  return `
    <div style="background:#1a1a1a;border-radius:14px;padding:14px;min-width:220px;max-width:260px;color:#fff;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        ${logoHtml}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
          ${r.address ? `<div style="font-size:11px;color:rgba(255,255,255,0.45);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.address}</div>` : ''}
        </div>
      </div>
      ${fotosHtml}
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">
        <a href="https://www.google.com/search?q=${encodeURIComponent(r.name)}" target="_blank" style="display:block;text-align:center;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);font-size:12px;font-weight:500;padding:8px 0;border-radius:10px;text-decoration:none;">🔍 Buscar en Google →</a>
        <a href="https://quierocomer.cl/localesfeed?q=${encodeURIComponent(r.name)}" target="_blank" style="display:block;text-align:center;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.5);color:#a78bfa;font-size:12px;font-weight:600;padding:8px 0;border-radius:10px;text-decoration:none;">📋 Abrir en Feed Locales ↗</a>
        <a href="/qr/${r.slug}" target="_blank" style="display:block;text-align:center;background:#ff4c00;color:#fff;font-size:12px;font-weight:600;padding:8px 0;border-radius:10px;text-decoration:none;">🍽 Ver carta →</a>
        <a href="${r.mapsUrl}" target="_blank" style="display:block;text-align:center;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);font-size:12px;font-weight:500;padding:8px 0;border-radius:10px;text-decoration:none;">📍 Google Maps →</a>
      </div>
    </div>
  `
}

export default function MapaLeaflet({ restaurantes, prospectos, drawMode, onPointAdded, onPolygonDblClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<globalThis.Map<string, L.CircleMarker>>(new globalThis.Map())
  const activeIdRef = useRef<string | null>(null)

  // Drawing refs
  const drawModeRef = useRef(false)
  const drawPointsRef = useRef<[number, number][]>([])
  const drawVerticesRef = useRef<L.Marker[]>([])
  const drawLineRef = useRef<L.Polyline | null>(null)
  const drawFillRef = useRef<L.Polygon | null>(null)

  const onPointAddedRef = useRef(onPointAdded)
  const onDblClickRef = useRef(onPolygonDblClick)
  useEffect(() => { onPointAddedRef.current = onPointAdded }, [onPointAdded])
  useEffect(() => { onDblClickRef.current = onPolygonDblClick }, [onPolygonDblClick])

  function updateDrawingLayers(map: L.Map, pts: [number, number][]) {
    drawLineRef.current?.remove()
    drawLineRef.current = pts.length >= 2
      ? L.polyline(pts, { color: '#ff4c00', weight: 2, dashArray: '6 4', opacity: 0.9 }).addTo(map)
      : null

    drawFillRef.current?.remove()
    drawFillRef.current = pts.length >= 3
      ? L.polygon(pts, { color: '#ff4c00', fillColor: '#ff4c00', fillOpacity: 0.12, weight: 2 }).addTo(map)
      : null
  }

  function clearDrawing(map: L.Map) {
    drawPointsRef.current = []
    drawVerticesRef.current.forEach(v => v.remove())
    drawVerticesRef.current = []
    drawLineRef.current?.remove()
    drawLineRef.current = null
    drawFillRef.current?.remove()
    drawFillRef.current = null
    map.getContainer().style.cursor = ''
  }

  // Sync drawMode into ref + update map cursor/clear
  useEffect(() => {
    drawModeRef.current = drawMode
    if (!mapRef.current) return
    if (drawMode) {
      mapRef.current.getContainer().style.cursor = 'crosshair'
      // Close open popups when entering draw mode
      mapRef.current.closePopup()
    } else {
      clearDrawing(mapRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Read initial position from URL hash (#lat,lng,zoom)
    let initCenter: [number, number] = [-33.45, -70.65]
    let initZoom = 11
    try {
      const hash = window.location.hash.slice(1)
      const parts = hash.split(',')
      if (parts.length === 3) {
        const hLat = parseFloat(parts[0])
        const hLng = parseFloat(parts[1])
        const hZoom = parseInt(parts[2])
        if (!isNaN(hLat) && !isNaN(hLng) && !isNaN(hZoom)) {
          initCenter = [hLat, hLng]
          initZoom = hZoom
        }
      }
    } catch {}

    const map = L.map(containerRef.current, {
      center: initCenter,
      zoom: initZoom,
    })
    mapRef.current = map

    // Persist map position to URL hash on move/zoom
    map.on('moveend', () => {
      const c = map.getCenter()
      const z = map.getZoom()
      window.history.replaceState(null, '', `#${c.lat.toFixed(5)},${c.lng.toFixed(5)},${z}`)
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    const markersMap = new globalThis.Map<string, L.CircleMarker>()

    for (const r of restaurantes) {
      const circle = L.circleMarker([r.lat, r.lng], normalStyle).addTo(map)

      const popup = L.popup({
        closeButton: false,
        className: 'qc-popup',
        maxWidth: 280,
        offset: [0, -8],
      })

      circle.on('click', (e) => {
        if (drawModeRef.current) return // ignore clicks on pins while drawing
        L.DomEvent.stopPropagation(e)

        if (activeIdRef.current && activeIdRef.current !== r.id) {
          const prev = markersMap.get(activeIdRef.current)
          if (prev) prev.setStyle(normalStyle)
        }
        activeIdRef.current = r.id
        circle.setStyle(selectedStyle)

        popup.setContent(buildPopupHtml(r, null))
        circle.bindPopup(popup).openPopup()

        fetch(`/api/mapalocales/fotos?id=${r.id}`)
          .then(res => res.json())
          .then(({ fotos }) => popup.setContent(buildPopupHtml(r, fotos)))
          .catch(() => popup.setContent(buildPopupHtml(r, [])))
      })

      popup.on('remove', () => {
        if (activeIdRef.current === r.id) {
          circle.setStyle(normalStyle)
          activeIdRef.current = null
        }
      })

      markersMap.set(r.id, circle)
    }
    markersRef.current = markersMap

    // Prospectos — puntos grises (debajo de los restaurantes activos)
    const prospectoCircles = new globalThis.Map<string, L.CircleMarker>()

    function buildProspectoPopup(p: ProspectoMapaData) {
      const comuna = p.address?.split(',').slice(-3, -2)[0]?.trim() ?? ''
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(p.name + (comuna ? ' ' + comuna : ''))}`
      return `
        <div style="background:#1a1a1a;border-radius:14px;padding:14px;min-width:210px;color:#fff;font-family:system-ui,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
            <div style="font-size:13px;font-weight:600;flex:1;margin-right:8px">${p.name}</div>
            <button data-delete-prospecto="${p.id}" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;flex-shrink:0">Borrar</button>
          </div>
          ${p.address ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:6px">${p.address}</div>` : ''}
          ${p.rating != null ? `<div style="font-size:12px;color:#f4a623;margin-bottom:8px">⭐ ${p.rating}${p.reviews != null ? ` · ${p.reviews} reseñas` : ''}</div>` : ''}
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            <a href="${googleSearchUrl}" target="_blank" style="display:block;text-align:center;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);font-size:11px;font-weight:500;padding:7px 0;border-radius:8px;text-decoration:none;">🔍 Buscar en Google →</a>
            <a href="https://quierocomer.cl/localesfeed?q=${encodeURIComponent(p.name)}" target="_blank" style="display:block;text-align:center;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);color:#a78bfa;font-size:11px;font-weight:600;padding:7px 0;border-radius:8px;text-decoration:none;">📋 Abrir en Locales Feed ↗</a>
            ${p.cartaUrl ? `<a href="${p.cartaUrl}" target="_blank" style="display:block;text-align:center;background:#ff4c00;color:#fff;font-size:11px;font-weight:600;padding:7px 0;border-radius:8px;text-decoration:none;">🍽 Ver carta${p.provider ? ` (${p.provider})` : ''} →</a>` : ''}
            <a href="${p.mapsUrl}" target="_blank" style="display:block;text-align:center;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);font-size:11px;font-weight:500;padding:7px 0;border-radius:8px;text-decoration:none;">📍 Google Maps →</a>
          </div>
        </div>
      `
    }

    for (const p of prospectos) {
      const circle = L.circleMarker([p.lat, p.lng], prospectoStyle).addTo(map)
      const popup = L.popup({ closeButton: false, className: 'qc-popup', maxWidth: 240, offset: [0, -6] })
      circle.on('click', (e) => {
        if (drawModeRef.current) return
        L.DomEvent.stopPropagation(e)
        popup.setContent(buildProspectoPopup(p))
        circle.bindPopup(popup).openPopup()
      })
      prospectoCircles.set(p.id, circle)
    }

    // Event delegation para el botón Borrar dentro de popups de prospectos
    map.getContainer().addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-delete-prospecto]') as HTMLElement | null
      if (!btn) return
      const id = btn.getAttribute('data-delete-prospecto')!
      btn.textContent = '...'
      btn.style.pointerEvents = 'none'
      fetch('/api/mapalocales/prospectos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      }).then(() => {
        const circle = prospectoCircles.get(id)
        if (circle) { circle.remove(); prospectoCircles.delete(id) }
        map.closePopup()
      }).catch(() => { btn.textContent = 'Error'; })
    })

    // Icono para vértices draggables
    function makeVertexIcon() {
      return L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;background:#ff4c00;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5);cursor:move"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })
    }

    // Map-level click: add draw vertex
    map.on('click', (e) => {
      if (!drawModeRef.current) return
      const { lat, lng } = e.latlng
      const idx = drawPointsRef.current.length
      drawPointsRef.current = [...drawPointsRef.current, [lat, lng]]

      // Vertex como marker draggable — impide que Leaflet arrastre el mapa
      const v = L.marker([lat, lng], {
        icon: makeVertexIcon(),
        draggable: true,
        autoPan: false,
      }).addTo(map)

      // Al arrastrar un vértice: actualiza su posición en drawPointsRef y redibuja
      v.on('drag', () => {
        const { lat: vLat, lng: vLng } = v.getLatLng()
        drawPointsRef.current[idx] = [vLat, vLng]
        updateDrawingLayers(map, drawPointsRef.current)
      })

      drawVerticesRef.current.push(v)
      updateDrawingLayers(map, drawPointsRef.current)
      onPointAddedRef.current([lat, lng], drawPointsRef.current.length)
    })

    // Double-click completes polygon
    map.on('dblclick', (e) => {
      if (!drawModeRef.current || drawPointsRef.current.length < 3) return
      L.DomEvent.stop(e)
      onDblClickRef.current()
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <style>{`
        .qc-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          border-radius: 14px !important;
          padding: 0 !important;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .qc-popup .leaflet-popup-content { margin: 0 !important; }
        .qc-popup .leaflet-popup-tip-container { display: none; }
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(0,0,0,0.6) !important;
          color: rgba(255,255,255,0.3) !important;
        }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.3) !important; }
        .leaflet-control-zoom a {
          background: #1a1a1a !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .leaflet-control-zoom a:hover { background: #2a2a2a !important; }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
