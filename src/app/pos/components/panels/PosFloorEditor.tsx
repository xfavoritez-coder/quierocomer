'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTables, useSectors } from '@/lib/pos/hooks'

// ── Types ──────────────────────────────────────────────────
interface FloorConfig {
  canvasW: number
  canvasH: number
  tables: Record<string, { shape: 'round' | 'square' | 'rect'; w: number; h: number; rotation: number }>
}

interface PosTable {
  id: string
  number: number
  label?: string
  sector_id?: string
  x: number
  y: number
  active: boolean
}

const F = "var(--sans, 'Inter', system-ui, sans-serif)"
const GRID = 20 // snap grid size
const PURPLE = '#8b5cf6'
const DEFAULT_SIZE = 64
const MIN_SIZE = 40
const SHAPES: ('round' | 'square' | 'rect')[] = ['round', 'square', 'rect']
const SHAPE_LABELS: Record<string, string> = { round: 'Redonda', square: 'Cuadrada', rect: 'Rectangular' }

function snap(v: number): number { return Math.round(v / GRID) * GRID }

function getTableStyle(cfg: FloorConfig, tableId: string) {
  return cfg.tables[tableId] || { shape: 'round', w: DEFAULT_SIZE, h: DEFAULT_SIZE, rotation: 0 }
}

// ── Main Editor ──────────────────────────────────────────────
export default function PosFloorEditor({ restaurantId }: { restaurantId: string }) {
  const rawTables = useTables(restaurantId)
  const sectors = useSectors(restaurantId)
  const [cfg, setCfg] = useState<FloorConfig>({ canvasW: 800, canvasH: 500, tables: {} })
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Load floor config from server
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/admin/locales/${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.posFloorConfig) {
          const fc = d.posFloorConfig as FloorConfig
          setCfg({ canvasW: fc.canvasW || 800, canvasH: fc.canvasH || 500, tables: fc.tables || {} })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [restaurantId])

  // Init positions from tables
  useEffect(() => {
    if (!loaded) return
    const m = new Map<string, { x: number; y: number }>()
    const hasLayoutData = rawTables.some(t => t.x > 0 || t.y > 0)
    rawTables.forEach((t, i) => {
      if (hasLayoutData) {
        m.set(t.id, { x: t.x, y: t.y })
      } else {
        // Auto-layout: grid of tables
        const col = i % 6
        const row = Math.floor(i / 6)
        m.set(t.id, { x: 40 + col * 100, y: 40 + row * 100 })
      }
    })
    setPositions(m)
  }, [rawTables, loaded])

  const sectorColor = useMemo(() => {
    const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
    const m = new Map<string, string>()
    sectors.forEach((s, i) => m.set(s.id, colors[i % colors.length]))
    return m
  }, [sectors])

  // ── Drag handlers ──────────────────────────────────────────
  const handlePointerDown = useCallback((tableId: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pos = positions.get(tableId) || { x: 0, y: 0 }
    setDragging({ id: tableId, offsetX: e.clientX - rect.left - pos.x, offsetY: e.clientY - rect.top - pos.y })
    setSelected(tableId)
  }, [positions])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = snap(Math.max(0, Math.min(cfg.canvasW - 40, e.clientX - rect.left - dragging.offsetX)))
    const y = snap(Math.max(0, Math.min(cfg.canvasH - 40, e.clientY - rect.top - dragging.offsetY)))
    setPositions(prev => { const m = new Map(prev); m.set(dragging.id, { x, y }); return m })
    setSaved(false)
  }, [dragging, cfg.canvasW, cfg.canvasH])

  const handlePointerUp = useCallback(() => { setDragging(null) }, [])

  // ── Shape/size controls ──────────────────────────────────
  const updateTableCfg = (tableId: string, patch: Partial<FloorConfig['tables'][string]>) => {
    setCfg(prev => ({
      ...prev,
      tables: { ...prev.tables, [tableId]: { ...getTableStyle(prev, tableId), ...patch } },
    }))
    setSaved(false)
  }

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      // Save floor config to restaurant
      await fetch(`/api/admin/locales/${restaurantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posFloorConfig: cfg }),
      })
      // Save table positions
      const updatedTables = rawTables.map(t => {
        const pos = positions.get(t.id) || { x: t.x, y: t.y }
        return { ...t, x: pos.x, y: pos.y, sector_id: t.sector_id }
      })
      await fetch('/api/pos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, action: 'tables.set', tables: updatedTables }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  // Auto-arrange: distribute evenly
  const autoArrange = () => {
    const m = new Map<string, { x: number; y: number }>()
    const cols = Math.ceil(Math.sqrt(rawTables.length * (cfg.canvasW / cfg.canvasH)))
    const cellW = Math.floor(cfg.canvasW / (cols || 1))
    const rows = Math.ceil(rawTables.length / cols)
    const cellH = Math.floor(cfg.canvasH / (rows || 1))
    rawTables.forEach((t, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      m.set(t.id, { x: snap(col * cellW + cellW / 2 - DEFAULT_SIZE / 2), y: snap(row * cellH + cellH / 2 - DEFAULT_SIZE / 2) })
    })
    setPositions(m)
    setSaved(false)
  }

  const selectedTable = rawTables.find(t => t.id === selected)
  const selectedStyle = selected ? getTableStyle(cfg, selected) : null

  if (rawTables.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem' }}>
        Agrega mesas en la seccion de arriba para usar el editor de salon.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={autoArrange} style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer' }}>
            Distribuir
          </button>
          <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>
            Arrastra las mesas para posicionarlas
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            fontFamily: F, fontSize: '0.78rem', fontWeight: 700,
            padding: '8px 20px', borderRadius: 10, border: 'none',
            background: saved ? '#22c55e' : PURPLE, color: '#fff',
            cursor: saving ? 'wait' : 'pointer', transition: 'background .2s',
          }}
        >
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar plano'}
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => setSelected(null)}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: cfg.canvasW,
          height: cfg.canvasH,
          background: 'var(--sunk)',
          border: '2px solid var(--line)',
          borderRadius: 16,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'default',
          touchAction: 'none',
          backgroundImage: `radial-gradient(circle, var(--line) 1px, transparent 1px)`,
          backgroundSize: `${GRID}px ${GRID}px`,
        }}
      >
        {/* Sector labels */}
        {sectors.length > 0 && (
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, zIndex: 5, pointerEvents: 'none' }}>
            {sectors.map(s => (
              <span key={s.id} style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${sectorColor.get(s.id)}20`, color: sectorColor.get(s.id), border: `1px solid ${sectorColor.get(s.id)}30` }}>
                {s.name}
              </span>
            ))}
          </div>
        )}

        {/* Tables */}
        {rawTables.map(table => {
          const pos = positions.get(table.id) || { x: 0, y: 0 }
          const style = getTableStyle(cfg, table.id)
          const isSelected = selected === table.id
          const color = table.sector_id ? (sectorColor.get(table.sector_id) || 'var(--ink-3)') : 'var(--ink-3)'
          const label = table.label || String(table.number)

          return (
            <div
              key={table.id}
              onPointerDown={(e) => handlePointerDown(table.id, e)}
              onClick={(e) => { e.stopPropagation(); setSelected(table.id) }}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: style.w,
                height: style.h,
                borderRadius: style.shape === 'round' ? '50%' : style.shape === 'rect' ? 8 : 10,
                background: isSelected ? `${PURPLE}30` : `${color}18`,
                border: `2.5px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? PURPLE : color}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: dragging?.id === table.id ? 'grabbing' : 'grab',
                transition: dragging?.id === table.id ? 'none' : 'box-shadow .15s',
                boxShadow: isSelected ? `0 0 0 3px ${PURPLE}40` : dragging?.id === table.id ? '0 8px 24px rgba(0,0,0,.18)' : '0 2px 8px rgba(0,0,0,.06)',
                zIndex: dragging?.id === table.id ? 100 : isSelected ? 50 : 10,
                transform: style.rotation ? `rotate(${style.rotation}deg)` : undefined,
                userSelect: 'none',
              }}
            >
              <span style={{ fontFamily: F, fontSize: style.w < 50 ? '0.6rem' : '0.72rem', fontWeight: 800, color: isSelected ? PURPLE : color, lineHeight: 1 }}>
                {label}
              </span>
              {table.sector_id && sectors.length > 0 && (
                <span style={{ fontFamily: F, fontSize: '0.48rem', color: isSelected ? PURPLE : color, opacity: 0.7, marginTop: 2 }}>
                  {sectors.find(s => s.id === table.sector_id)?.name || ''}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected table properties */}
      {selectedTable && selectedStyle && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: F, fontSize: '0.78rem', fontWeight: 800, color: 'var(--ink)' }}>
            {selectedTable.label || `Mesa ${selectedTable.number}`}
          </div>

          {/* Shape */}
          <div>
            <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }}>Forma</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {SHAPES.map(s => (
                <button
                  key={s}
                  onClick={() => updateTableCfg(selected!, { shape: s, ...(s === 'rect' ? { w: 90, h: 56 } : s === 'square' ? { w: 64, h: 64 } : { w: 64, h: 64 }) })}
                  style={{
                    fontFamily: F, fontSize: '0.7rem', fontWeight: 600,
                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    border: selectedStyle.shape === s ? `2px solid ${PURPLE}` : '1px solid var(--line)',
                    background: selectedStyle.shape === s ? `${PURPLE}14` : 'var(--surface)',
                    color: selectedStyle.shape === s ? PURPLE : 'var(--ink-2)',
                  }}
                >
                  {SHAPE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }}>
              Tamaño: {selectedStyle.w} × {selectedStyle.h}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="range" min={MIN_SIZE} max={140} value={selectedStyle.w}
                onChange={e => updateTableCfg(selected!, { w: +e.target.value, ...(selectedStyle.shape !== 'rect' ? { h: +e.target.value } : {}) })}
                style={{ flex: 1, accentColor: PURPLE }} />
              {selectedStyle.shape === 'rect' && (
                <input type="range" min={MIN_SIZE} max={140} value={selectedStyle.h}
                  onChange={e => updateTableCfg(selected!, { h: +e.target.value })}
                  style={{ flex: 1, accentColor: PURPLE }} />
              )}
            </div>
          </div>

          {/* Rotation */}
          <div>
            <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }}>
              Rotacion: {selectedStyle.rotation}°
            </span>
            <input type="range" min={0} max={360} step={15} value={selectedStyle.rotation}
              onChange={e => updateTableCfg(selected!, { rotation: +e.target.value })}
              style={{ width: '100%', accentColor: PURPLE }} />
          </div>
        </div>
      )}
    </div>
  )
}
