'use client'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Pt { lat: number; lng: number; net?: number }

interface Cluster {
  lat: number; lng: number;
  count: number; avgNet: number;
}

// Agrupa puntos en celdas de ~700m usando una cuadrícula de coordenadas
function clusterPoints(points: Pt[], gridDeg = 0.007): Cluster[] {
  const grid = new Map<string, { latSum: number; lngSum: number; count: number; netSum: number }>()
  for (const p of points) {
    const key = `${Math.round(p.lat / gridDeg)},${Math.round(p.lng / gridDeg)}`
    const e = grid.get(key)
    if (e) { e.latSum += p.lat; e.lngSum += p.lng; e.count++; e.netSum += p.net ?? 0 }
    else grid.set(key, { latSum: p.lat, lngSum: p.lng, count: 1, netSum: p.net ?? 0 })
  }
  return Array.from(grid.values()).map(c => ({
    lat: c.latSum / c.count,
    lng: c.lngSum / c.count,
    count: c.count,
    avgNet: c.count > 0 ? Math.round(c.netSum / c.count) : 0,
  }))
}

function clpShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

// Paleta de colores: frío (azul) → cálido (rojo). Array de 256 RGBA.
function buildPalette(): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 1
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0,    'rgba(0,0,255,0)')
  grad.addColorStop(0.25, 'rgba(0,255,255,0.6)')
  grad.addColorStop(0.55, 'rgba(0,255,0,0.8)')
  grad.addColorStop(0.75, 'rgba(255,255,0,0.9)')
  grad.addColorStop(1,    'rgba(255,0,0,1)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 1)
  return ctx.getImageData(0, 0, 256, 1).data
}

// Dibuja el mapa de calor sobre un canvas.
function drawHeatmap(canvas: HTMLCanvasElement, map: L.Map, points: Pt[], radius: number) {
  const size = map.getSize()
  canvas.width  = size.x
  canvas.height = size.y
  if (points.length === 0) return

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 1. Pintar círculos difuminados en blanco sobre fondo negro (additive)
  const offscreen = document.createElement('canvas')
  offscreen.width  = canvas.width
  offscreen.height = canvas.height
  const off = offscreen.getContext('2d')!
  off.globalCompositeOperation = 'lighter'

  const blur = Math.round(radius * 0.6)

  for (const pt of points) {
    const px = map.latLngToContainerPoint([pt.lat, pt.lng])
    if (px.x < -radius || px.y < -radius || px.x > canvas.width + radius || px.y > canvas.height + radius) continue
    const grad = off.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius)
    grad.addColorStop(0,    `rgba(255,255,255,${blur > 0 ? 0.9 : 0.5})`)
    grad.addColorStop(0.4,  'rgba(255,255,255,0.4)')
    grad.addColorStop(1,    'rgba(0,0,0,0)')
    off.fillStyle = grad
    off.beginPath()
    off.arc(px.x, px.y, radius, 0, Math.PI * 2)
    off.fill()
  }

  // 2. Colorizar usando la paleta
  const imgData = off.getImageData(0, 0, offscreen.width, offscreen.height)
  const data = imgData.data
  const palette = buildPalette()

  for (let i = 0; i < data.length; i += 4) {
    const v = data[i]
    if (v === 0) continue
    const idx = v * 4
    data[i]     = palette[idx]
    data[i + 1] = palette[idx + 1]
    data[i + 2] = palette[idx + 2]
    data[i + 3] = palette[idx + 3]
  }

  ctx.putImageData(imgData, 0, 0)
}

function buildClusterIcon(count: number, maxCount: number): L.DivIcon {
  const ratio = count / Math.max(1, maxCount)
  const size = Math.round(Math.max(32, Math.min(60, 28 + ratio * 32)))
  // Color: azul para pocos pedidos, naranja para muchos
  const hue = Math.round(220 - ratio * 160) // 220 = azul, 60 = amarillo→naranja
  const fontSize = size > 42 ? 13 : 11
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:hsla(${hue},80%,48%,0.88);
      border:2.5px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 8px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:800;font-size:${fontSize}px;
      font-family:system-ui,sans-serif;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function buildClusterLayer(map: L.Map, points: Pt[]): L.LayerGroup {
  const clusters = clusterPoints(points)
  const maxCount = Math.max(1, ...clusters.map(c => c.count))
  const hasNetData = points.some(p => (p.net ?? 0) > 0)

  const layer = L.layerGroup()

  for (const c of clusters) {
    const marker = L.marker([c.lat, c.lng], {
      icon: buildClusterIcon(c.count, maxCount),
      zIndexOffset: 500,
    })

    const countLine = `<strong>${c.count} pedido${c.count !== 1 ? 's' : ''}</strong>`
    const spendLine = hasNetData && c.avgNet > 0
      ? `<br><span style="color:#6b7280;font-size:11px;">Ticket prom. </span><strong style="color:#111;">${clpShort(c.avgNet)}</strong>`
      : ''

    marker.bindTooltip(
      `<div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;padding:1px 2px;">${countLine}${spendLine}</div>`,
      { sticky: false, direction: 'top', offset: [0, -8] }
    )
    marker.addTo(layer)
  }

  return layer
}

export default function DeliveryHeatmap({ points }: { points: Pt[] }) {
  const divRef         = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<L.Map | null>(null)
  const canvasRef      = useRef<HTMLCanvasElement | null>(null)
  const clusterLayerRef = useRef<L.LayerGroup | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [view, setView] = useState<'heat' | 'sectors'>('heat')

  // Inicializar mapa una sola vez
  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    const map = L.map(divRef.current, { zoomControl: true, attributionControl: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

    // Canvas overlay que se posiciona sobre el pane del mapa
    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, {
      position: 'absolute', top: '0', left: '0',
      pointerEvents: 'none', zIndex: '400',
      transition: 'opacity .2s',
    })
    map.getPanes().overlayPane.appendChild(canvas)
    canvasRef.current = canvas

    mapRef.current = map

    const redraw = () => {
      if (!canvasRef.current || !mapRef.current) return
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      drawHeatmap(canvas, map, points, getRadius(map.getZoom()))
    }

    map.on('moveend zoomend resize', redraw)

    // Vista inicial: centrar en los puntos o default Santiago
    if (points.length > 0) {
      const lats = points.map(p => p.lat)
      const lngs = points.map(p => p.lng)
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      )
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else {
      map.setView([-33.45, -70.66], 11)
    }

    setTimeout(() => { map.invalidateSize(); redraw() }, 150)

    return () => {
      map.remove()
      mapRef.current = null
      canvasRef.current = null
      clusterLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ajustar tamaño al cambiar modo pantalla completa
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = setTimeout(() => {
      map.invalidateSize()
      const canvas = canvasRef.current
      if (canvas && view === 'heat') {
        const topLeft = map.containerPointToLayerPoint([0, 0])
        L.DomUtil.setPosition(canvas, topLeft)
        drawHeatmap(canvas, map, points, getRadius(map.getZoom()))
      }
    }, 50)
    return () => clearTimeout(t)
  }, [fullscreen, points, view])

  // Cerrar pantalla completa con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Redibujar cuando cambian los puntos
  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (points.length > 0) {
      const lats = points.map(p => p.lat)
      const lngs = points.map(p => p.lng)
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      )
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }

    // Reasignar el handler con los nuevos puntos
    map.off('moveend zoomend resize')
    const redraw = () => {
      if (!canvasRef.current || !mapRef.current) return
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      drawHeatmap(canvas, map, points, getRadius(map.getZoom()))
    }
    map.on('moveend zoomend resize', redraw)

    // Actualizar la vista actual
    if (view === 'heat') {
      canvas.style.opacity = '1'
      setTimeout(() => redraw(), 50)
      if (clusterLayerRef.current) {
        map.removeLayer(clusterLayerRef.current)
        clusterLayerRef.current = null
      }
    } else {
      canvas.style.opacity = '0'
      if (clusterLayerRef.current) map.removeLayer(clusterLayerRef.current)
      const layer = buildClusterLayer(map, points)
      layer.addTo(map)
      clusterLayerRef.current = layer
    }
  }, [points, view])

  // Cambio de vista (heat ↔ sectors)
  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (view === 'heat') {
      canvas.style.opacity = '1'
      if (clusterLayerRef.current) {
        map.removeLayer(clusterLayerRef.current)
        clusterLayerRef.current = null
      }
      // Redibujar heatmap
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      drawHeatmap(canvas, map, points, getRadius(map.getZoom()))
    } else {
      canvas.style.opacity = '0'
      if (clusterLayerRef.current) map.removeLayer(clusterLayerRef.current)
      const layer = buildClusterLayer(map, points)
      layer.addTo(map)
      clusterLayerRef.current = layer
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const controls = (
    <>
      {/* Toggle Calor / Sectores */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
        display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.12)', overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}>
        {(['heat', 'sectors'] as const).map((v, i) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '5px 10px', border: 'none',
              borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              fontFamily: 'system-ui,sans-serif',
              background: view === v ? '#3b82f6' : 'transparent',
              color: view === v ? '#fff' : '#444',
              transition: 'background .15s, color .15s',
            }}
          >
            {v === 'heat' ? 'Calor' : 'Sectores'}
          </button>
        ))}
      </div>

      {/* Botón pantalla completa */}
      <button
        onClick={() => setFullscreen(f => !f)}
        title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 10000,
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.15)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        {fullscreen ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
            <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        )}
      </button>
    </>
  )

  if (fullscreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}>
        <div ref={divRef} style={{ width: '100%', height: '100%' }} />
        {controls}
      </div>
    )
  }

  return (
    // Outer wrapper: position:relative but NO overflow:hidden so bottom:12 works reliably
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Inner map container: overflow:hidden for border-radius clipping */}
      <div style={{ width: '100%', height: 340, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <div ref={divRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {controls}
    </div>
  )
}

function getRadius(zoom: number): number {
  if (zoom >= 16) return 40
  if (zoom >= 14) return 32
  if (zoom >= 12) return 24
  if (zoom >= 10) return 18
  return 14
}
