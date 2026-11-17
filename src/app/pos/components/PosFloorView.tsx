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

  // Auto-scale to fit container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setScale(Math.min(1, width / canvasW))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [canvasW])

  const hasFloorPlan = tables.some(t => t.x > 0 || t.y > 0)
  if (!hasFloorPlan) return null // fallback to grid

  const sectorColors = useMemo(() => {
    const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
    const m = new Map<string, string>()
    sectors.forEach((s, i) => m.set(s.id, colors[i % colors.length]))
    return m
  }, [sectors])

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{
        position: 'relative',
        width: canvasW,
        height: canvasH,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        marginBottom: canvasH * (scale - 1),
        background: 'var(--sunk)',
        borderRadius: 16,
        border: '1px solid var(--line)',
      }}>
        {tables.map(table => {
          const pos = { x: table.x, y: table.y }
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
              onClick={() => onMesaClick(table)}
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
              <span style={{ fontSize: style.w < 50 ? '0.58rem' : '0.68rem', fontWeight: 800, color: occupied ? statusColor : 'var(--ink-2)', lineHeight: 1 }}>
                {key}
              </span>

              {occupied ? (
                <>
                  {/* Amount */}
                  <span style={{ fontFamily: MONO, fontSize: style.w < 50 ? '0.52rem' : '0.62rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1, marginTop: 2 }}>
                    ${Math.round(order.totalAmount || 0).toLocaleString('es-CL')}
                  </span>
                  {/* Time */}
                  <span style={{ fontSize: '0.5rem', fontWeight: 600, color: statusColor, lineHeight: 1, marginTop: 1 }}>
                    <LiveClock since={order.createdAt} />
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.48rem', color: 'var(--ink-4)', lineHeight: 1, marginTop: 1 }}>Libre</span>
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
