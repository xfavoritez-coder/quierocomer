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

interface ClientPt {
  name: string; phone: string; email: string;
  lat: number; lng: number; address: string;
  orders: number; totalSpent: number; avgTicket: number;
  firstOrderAt: string; lastOrderAt: string;
}

export default function DeliveryHeatmap({ points, restaurantId, allBranches, fromDate, toDate }: { points: Pt[]; restaurantId?: string; allBranches?: { id: string }[]; fromDate?: string; toDate?: string }) {
  const divRef         = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<L.Map | null>(null)
  const canvasRef      = useRef<HTMLCanvasElement | null>(null)
  const clusterLayerRef = useRef<L.LayerGroup | null>(null)
  const clientLayerRef = useRef<L.LayerGroup | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [view, setView] = useState<'heat' | 'sectors' | 'clients'>('heat')
  const [clients, setClients] = useState<ClientPt[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientPt | null>(null)

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

    // Limpiar capas anteriores
    canvas.style.opacity = '0'
    if (clusterLayerRef.current) { map.removeLayer(clusterLayerRef.current); clusterLayerRef.current = null }
    if (clientLayerRef.current) { map.removeLayer(clientLayerRef.current); clientLayerRef.current = null }
    setSelectedClient(null)

    if (view === 'heat') {
      canvas.style.opacity = '1'
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      drawHeatmap(canvas, map, points, getRadius(map.getZoom()))
    } else if (view === 'sectors') {
      const layer = buildClusterLayer(map, points)
      layer.addTo(map)
      clusterLayerRef.current = layer
    } else if (view === 'clients') {
      // Fetch client data lazy
      if (restaurantId) {
        setClientsLoading(true)
        const ids = allBranches && allBranches.length > 1 ? allBranches.map(b => b.id) : [restaurantId]
        Promise.all(ids.map(id =>
          fetch(`/api/panel/ecommerce/pos-orders/delivery-locations?restaurantId=${id}&mode=clients&from=${fromDate || ''}&to=${toDate || ''}`)
            .then(r => r.ok ? r.json() : { clients: [] }).catch(() => ({ clients: [] }))
        )).then(results => {
          const all: ClientPt[] = results.flatMap((r: any) => r.clients || [])
          // Dedup by phone
          const seen = new Map<string, ClientPt>()
          for (const c of all) {
            const key = c.phone.replace(/\D/g, '')
            const ex = seen.get(key)
            if (ex) { ex.orders += c.orders; ex.totalSpent += c.totalSpent; ex.avgTicket = Math.round(ex.totalSpent / ex.orders) }
            else seen.set(key, { ...c })
          }
          const deduped = [...seen.values()].sort((a, b) => b.totalSpent - a.totalSpent)
          setClients(deduped)
          setClientsLoading(false)

          // Render markers
          const layer = L.layerGroup()
          const maxSpent = Math.max(1, ...deduped.map(c => c.totalSpent))
          for (const c of deduped) {
            const size = 8 + Math.round((c.totalSpent / maxSpent) * 16)
            const color = c.orders > 5 ? '#16a34a' : c.orders > 1 ? '#f59e0b' : '#9ca3af'
            const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
            const marker = L.circleMarker([c.lat, c.lng], {
              radius: size / 2, fillColor: color, fillOpacity: 0.8,
              color: '#fff', weight: 2, opacity: 1,
            })
            marker.bindTooltip(`<b>${c.name}</b><br/>${c.orders} pedidos · ${clp(c.totalSpent)}`, { className: 'leaflet-tooltip-custom' })
            marker.on('click', () => setSelectedClient(c))
            layer.addLayer(marker)
          }
          layer.addTo(map)
          clientLayerRef.current = layer
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, restaurantId, fromDate, toDate])

  const controls = (
    <>
      {/* Toggle Calor / Sectores */}
      <div style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
        display: 'flex', background: 'rgba(255,255,255,0.95)', borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.12)', overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}>
        {(['heat', 'sectors', 'clients'] as const).map((v, i) => (
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
            {v === 'heat' ? 'Calor' : v === 'sectors' ? 'Sectores' : 'Clientes'}
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

  return (
    <div style={fullscreen
      ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }
      : { position: 'relative', width: '100%' }
    }>
      <div style={fullscreen
        ? { width: '100%', height: '100%' }
        : { width: '100%', height: 340, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }
      }>
        <div ref={divRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {controls}

      {/* Loading clientes */}
      {view === 'clients' && clientsLoading && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#666', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          Cargando clientes…
        </div>
      )}

      {/* Panel detalle cliente */}
      {selectedClient && (() => {
        const c = selectedClient
        const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
        const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d } }
        const waPhone = c.phone.replace(/\D/g, '')
        const freq = c.orders > 1 ? Math.round((new Date(c.lastOrderAt).getTime() - new Date(c.firstOrderAt).getTime()) / (c.orders - 1) / 86400000) : null
        return (
          <div style={{
            position: 'absolute', top: 10, right: 50, zIndex: 10001,
            width: 280, background: '#fff', borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontFamily: 'system-ui,sans-serif',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>{c.name}</div>
                <button onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{c.address}</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{c.orders}</div>
                  <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Pedidos</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{clp(c.totalSpent)}</div>
                  <div style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>Total gastado</div>
                </div>
              </div>
              {/* Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: '#555' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  Ticket promedio: <b>{clp(c.avgTicket)}</b>
                </div>
                {freq !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Pide cada <b>{freq} días</b>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Último: {fmtDate(c.lastOrderAt)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Primero: {fmtDate(c.firstOrderAt)}
                </div>
                {c.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {c.phone}
                  </div>
                )}
                {c.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    {c.email}
                  </div>
                )}
              </div>
              {/* WhatsApp button */}
              {waPhone && (
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, background: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginTop: 2 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        )
      })()}
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
