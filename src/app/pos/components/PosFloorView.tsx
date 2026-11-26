'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────
interface FloorConfig {
  canvasW: number
  canvasH: number
  tables: Record<string, { shape: 'round' | 'square' | 'rect'; w: number; h: number; rotation: number }>
}

interface PosTable {
  id: string
  restaurant_id: string
  number: number
  label?: string
  sector_id?: string
  x: number
  y: number
  active: boolean
}

interface Props {
  tables: PosTable[]
  config: FloorConfig | null
  mesaOrderByLabel: Map<string, any>
  sectors: { id: string; name: string; position: number }[]
  onMesaClick: (table: PosTable) => void
  selectedKey?: string | null
}

const F = "var(--sans, 'Inter', system-ui, sans-serif)"
const MONO = "var(--mono, 'JetBrains Mono', monospace)"
const DEFAULT_SIZE = 64

function getTableStyle(cfg: FloorConfig | null, tableId: string) {
  return cfg?.tables?.[tableId] || { shape: 'round' as const, w: DEFAULT_SIZE, h: DEFAULT_SIZE, rotation: 0 }
}

function LiveClock({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(iv)
  }, [])
  const mins = Math.round((now - new Date(since).getTime()) / 60000)
  if (mins < 60) return <>{mins}m</>
  return <>{Math.floor(mins / 60)}h{mins % 60 > 0 ? ` ${mins % 60}m` : ''}</>
}

export default function PosFloorView({ tables, config, mesaOrderByLabel, sectors, onMesaClick, selectedKey }: Props) {
  const canvasW = config?.canvasW || 800
  const canvasH = config?.canvasH || 500
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Calculate bounding box of actual table positions for smart scaling
  const bbox = useMemo(() => {
    if (!tables.length) return { x: 0, y: 0, w: canvasW, h: canvasH }
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
    for (const t of tables) {
      const s = getTableStyle(config, t.id)
      minX = Math.min(minX, t.x)
      minY = Math.min(minY, t.y)
      maxX = Math.max(maxX, t.x + s.w)
      maxY = Math.max(maxY, t.y + s.h)
    }
    const pad = 30
    return { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad), w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [tables, config, canvasW, canvasH])

  // Auto-scale: llena TODO el ancho disponible (sin cap bajo) manteniendo la relación de
  // aspecto; solo se limita por un presupuesto de alto (para no exceder la pantalla).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const recompute = () => {
      const width = el.clientWidth || el.getBoundingClientRect().width
      if (!width) return
      // Prioriza LLENAR EL ANCHO disponible (el contenedor hace scroll vertical si queda
      // alto). Cap 2.6x para no agrandar demasiado cuando hay pocas mesas.
      setScale(Math.max(0.3, Math.min(width / bbox.w, 1.8)))
    }
    recompute()
    const obs = new ResizeObserver(recompute)
    obs.observe(el)
    window.addEventListener('resize', recompute)
    return () => { obs.disconnect(); window.removeEventListener('resize', recompute) }
  }, [bbox])

  const hasFloorPlan = tables.some(t => t.x > 0 || t.y > 0)
  if (!hasFloorPlan) return null // fallback to grid

  const sectorColors = useMemo(() => {
    const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
    const m = new Map<string, string>()
    sectors.forEach((s, i) => m.set(s.id, colors[i % colors.length]))
    return m
  }, [sectors])

  const viewW = bbox.w
  const viewH = bbox.h
  const offsetX = bbox.x
  const offsetY = bbox.y

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        position: 'relative',
        width: viewW,
        height: viewH,
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        marginBottom: Math.max(0, viewH * scale - viewH + 10),
        background: 'var(--sunk)',
        borderRadius: 16,
        border: '1px solid var(--line)',
      }}>
        {tables.map(table => {
          const pos = { x: table.x - offsetX, y: table.y - offsetY }
          const style = getTableStyle(config, table.id)
          const key = table.label || String(table.number)
          const order = mesaOrderByLabel.get(key)
          const occupied = !!order
          const isSelected = selectedKey === key

          // Status colors
          let statusColor = 'var(--ink-4)' // libre
          let statusBg = 'var(--surface)'
          let statusLabel = 'Libre'
          if (occupied) {
            const mins = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000)
            if (order.posStatus === 'preparing') { statusColor = '#f59e0b'; statusBg = '#fef3c7'; statusLabel = 'Preparando' }
            else if (order.posStatus === 'ready') { statusColor = '#3b82f6'; statusBg = '#dbeafe'; statusLabel = 'Listo' }
            else if (mins > 60) { statusColor = '#ef4444'; statusBg = '#fef2f2'; statusLabel = 'Esperando' }
            else { statusColor = '#8b5cf6'; statusBg = '#f3e8ff'; statusLabel = 'Comiendo' }
          }

          const sColor = table.sector_id ? (sectorColors.get(table.sector_id) || 'var(--ink-4)') : undefined

          return (
            <button
              key={table.id}
              onClick={(e) => { e.stopPropagation(); onMesaClick(table) }}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: style.w,
                height: style.h,
                borderRadius: style.shape === 'round' ? '50%' : style.shape === 'rect' ? 8 : 10,
                background: occupied ? statusBg : 'var(--surface)',
                border: `2.5px solid ${isSelected ? '#8b5cf6' : occupied ? statusColor : (sColor || 'var(--line)')}`,
                boxShadow: isSelected ? '0 0 0 3px rgba(139,92,246,.35)' : occupied ? `0 4px 14px ${statusColor}22` : '0 1px 4px rgba(0,0,0,.06)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transform: style.rotation ? `rotate(${style.rotation}deg)` : undefined,
                transition: 'box-shadow .15s, border-color .15s',
                zIndex: isSelected ? 20 : occupied ? 10 : 1,
                fontFamily: F,
                gap: 1,
              }}
            >
              {/* Label */}
              <span style={{ fontSize: style.w < 55 ? '0.78rem' : '0.92rem', fontWeight: 900, color: occupied ? statusColor : 'var(--ink-2)', lineHeight: 1 }}>
                {key}
              </span>

              {occupied ? (
                <>
                  {/* Amount */}
                  <span style={{ fontFamily: MONO, fontSize: style.w < 55 ? '0.68rem' : '0.78rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1, marginTop: 3 }}>
                    ${Math.round(order.totalAmount || 0).toLocaleString('es-CL')}
                  </span>
                  {/* Time */}
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: statusColor, lineHeight: 1, marginTop: 2 }}>
                    <LiveClock since={order.createdAt} />
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--ink-4)', lineHeight: 1, marginTop: 2 }}>Libre</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '10px 4px 0', flexWrap: 'wrap' }}>
        {[
          { color: 'var(--ink-4)', label: 'Libre' },
          { color: '#8b5cf6', label: 'Comiendo' },
          { color: '#f59e0b', label: 'Preparando' },
          { color: '#3b82f6', label: 'Listo' },
          { color: '#ef4444', label: 'Esperando cuenta' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontFamily: F, fontSize: '0.64rem', color: 'var(--ink-3)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
