'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Pt { lat: number; lng: number }

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
    const v = data[i]            // intensidad (canal R, igual R=G=B en blanco)
    if (v === 0) continue
    const idx = v * 4            // lookup en la paleta
    data[i]     = palette[idx]
    data[i + 1] = palette[idx + 1]
    data[i + 2] = palette[idx + 2]
    data[i + 3] = palette[idx + 3]
  }

  ctx.putImageData(imgData, 0, 0)
}

export default function DeliveryHeatmap({ points }: { points: Pt[] }) {
  const divRef    = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<L.Map | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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
    })
    map.getPanes().overlayPane.appendChild(canvas)
    canvasRef.current = canvas

    mapRef.current = map

    const redraw = () => {
      if (!canvasRef.current || !mapRef.current) return
      // Reposicionar canvas: el overlayPane puede tener un transform aplicado por Leaflet
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
    }
    // Solo en mount — los puntos se actualizan con el efecto de abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTimeout(() => redraw(), 50)
  }, [points])

  return <div ref={divRef} style={{ width: '100%', height: 340, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }} />
}

function getRadius(zoom: number): number {
  // Radio en píxeles según el nivel de zoom
  if (zoom >= 16) return 40
  if (zoom >= 14) return 32
  if (zoom >= 12) return 24
  if (zoom >= 10) return 18
  return 14
}
