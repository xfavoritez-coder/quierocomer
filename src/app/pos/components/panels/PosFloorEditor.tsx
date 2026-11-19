'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTables, useSectors } from '@/lib/pos/hooks'

// ── Types ──────────────────────────────────────────────────
interface FloorConfig {
  canvasW: number
  canvasH: number
  enabled?: boolean // si true, el POS usa esta distribución real en la pestaña Mesas
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Arrastre de una mesa o de un grupo seleccionado (delta sobre las posiciones originales).
  const [dragging, setDragging] = useState<{ ids: string[]; startX: number; startY: number; orig: Map<string, { x: number; y: number }> } | null>(null)
  // Rectángulo de selección múltiple (marquee).
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const marqueeRef = useRef<{ x0: number; y0: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  // Ancho REAL del canvas (el elemento es responsive: width:100%, maxWidth:cfg.canvasW).
  // Si usáramos cfg.canvasW (800) para la grilla pero el contenedor es más angosto, las
  // columnas de la derecha quedarían fuera de vista (overflow:hidden) → mesas "perdidas".
  const [canvasW, setCanvasW] = useState(800)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const update = () => setCanvasW(Math.round(el.getBoundingClientRect().width) || 800)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loaded])

  // Load floor config from server
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/admin/locales/${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.posFloorConfig) {
          const fc = d.posFloorConfig as FloorConfig
          setCfg({ canvasW: fc.canvasW || 800, canvasH: fc.canvasH || 500, enabled: fc.enabled === true, tables: fc.tables || {} })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [restaurantId])

  // Init / sincroniza posiciones de las mesas. MERGE (no rebuild): preserva las
  // posiciones que ya hay en el estado —incluidos los arrastres sin guardar— y solo
  // coloca las mesas que aún no tenemos. Antes rehacía todo el mapa en cada cambio de
  // `rawTables` (el store hace polling), reseteando los arrastres a las posiciones del
  // servidor; y las mesas sin posición (x=0,y=0) caían TODAS en {0,0} → se amontonaban.
  useEffect(() => {
    if (!loaded) return
    setPositions(prev => {
      const m = new Map(prev)
      const ids = new Set(rawTables.map(t => t.id))
      for (const id of [...m.keys()]) if (!ids.has(id)) m.delete(id) // quitar mesas borradas
      // Las x/y guardadas por el seed de la migración son ÍNDICES de grilla (0,1,2…),
      // no píxeles → el editor las pintaba todas en el rincón (0-4px) = amontonadas.
      // Si TODO el layout cabe en un cuadrito, no son píxeles reales → re-distribuir.
      const maxX = Math.max(0, ...rawTables.map(t => t.x))
      const maxY = Math.max(0, ...rawTables.map(t => t.y))
      const piled = maxX <= 40 && maxY <= 40
      const W = canvasW // ancho REAL (no cfg.canvasW) → las mesas caben en lo visible
      const inView = (p: { x: number; y: number }, id: string) => {
        const s = getTableStyle(cfg, id)
        return p.x >= 0 && p.y >= 0 && p.x + s.w <= W && p.y + s.h <= cfg.canvasH
      }
      const STEP = 100
      const cols = Math.max(1, Math.floor((W - 40) / STEP))
      const collides = (x: number, y: number) =>
        [...m.values()].some(p => Math.abs(p.x - x) < 72 && Math.abs(p.y - y) < 72)
      let slot = 0
      for (const t of rawTables) {
        const cur = m.get(t.id)
        if (cur && inView(cur, t.id)) continue       // ya posicionada y VISIBLE → preservar
        if (cur) m.delete(t.id)                       // estaba fuera de vista → reubicar
        const saved = { x: t.x, y: t.y }
        if (!piled && (t.x > 0 || t.y > 0) && inView(saved, t.id)) { m.set(t.id, saved); continue } // píxeles reales y visibles
        // Sin posición visible (o índices amontonados): primera celda libre de la grilla.
        let x = 40, y = 40, tries = 0
        do {
          x = snap(40 + (slot % cols) * STEP)
          y = snap(40 + Math.floor(slot / cols) * STEP)
          slot++; tries++
        } while (collides(x, y) && tries < 600)
        m.set(t.id, { x, y })
      }
      return m
    })
  }, [rawTables, loaded, canvasW]) // eslint-disable-line react-hooks/exhaustive-deps

  const sectorColor = useMemo(() => {
    const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
    const m = new Map<string, string>()
    sectors.forEach((s, i) => m.set(s.id, colors[i % colors.length]))
    return m
  }, [sectors])

  // ── Drag de mesa(s) ────────────────────────────────────────
  const handleTablePointerDown = useCallback((tableId: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    // Si la mesa es parte de una selección múltiple, arrastra TODO el grupo; si no, solo ella.
    const inGroup = selectedIds.has(tableId) && selectedIds.size > 1
    const group = inGroup ? [...selectedIds] : [tableId]
    if (!inGroup) setSelectedIds(new Set([tableId]))
    const orig = new Map<string, { x: number; y: number }>()
    for (const id of group) orig.set(id, positions.get(id) || { x: 0, y: 0 })
    setDragging({ ids: group, startX: e.clientX, startY: e.clientY, orig })
  }, [positions, selectedIds])

  // ── Marquee (selección por rectángulo) sobre el canvas vacío ──
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    marqueeRef.current = { x0: x, y0: y }
    setMarquee({ x0: x, y0: y, x1: x, y1: y })
    setSelectedIds(new Set()) // un clic vacío limpia; si arrastra, el move selecciona
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    if (dragging) {
      const dx = e.clientX - dragging.startX, dy = e.clientY - dragging.startY
      setPositions(prev => {
        const m = new Map(prev)
        for (const id of dragging.ids) {
          const o = dragging.orig.get(id) || { x: 0, y: 0 }
          m.set(id, {
            x: snap(Math.max(0, Math.min(canvasW - 40, o.x + dx))),
            y: snap(Math.max(0, Math.min(cfg.canvasH - 40, o.y + dy))),
          })
        }
        return m
      })
      setSaved(false)
      return
    }
    if (marqueeRef.current) {
      const x = e.clientX - rect.left, y = e.clientY - rect.top
      const { x0, y0 } = marqueeRef.current
      setMarquee({ x0, y0, x1: x, y1: y })
      const minX = Math.min(x0, x), maxX = Math.max(x0, x), minY = Math.min(y0, y), maxY = Math.max(y0, y)
      const sel = new Set<string>()
      for (const t of rawTables) {
        const p = positions.get(t.id) || { x: 0, y: 0 }
        const s = getTableStyle(cfg, t.id)
        if (p.x < maxX && p.x + s.w > minX && p.y < maxY && p.y + s.h > minY) sel.add(t.id) // AABB intersecta
      }
      setSelectedIds(sel)
    }
  }, [dragging, cfg, rawTables, positions, canvasW])

  const handlePointerUp = useCallback(() => { setDragging(null); marqueeRef.current = null; setMarquee(null) }, [])

  // ── Shape/size/rotation — aplica a TODAS las mesas seleccionadas ──
  const applyToSelected = (patch: Partial<FloorConfig['tables'][string]>) => {
    if (selectedIds.size === 0) return
    setCfg(prev => {
      const tables = { ...prev.tables }
      for (const id of selectedIds) tables[id] = { ...getTableStyle(prev, id), ...patch }
      return { ...prev, tables }
    })
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
    const cols = Math.ceil(Math.sqrt(rawTables.length * (canvasW / cfg.canvasH)))
    const cellW = Math.floor(canvasW / (cols || 1))
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

  const selIds = [...selectedIds]
  const primaryId = selIds[0] || null
  const primaryTable = rawTables.find(t => t.id === primaryId)
  const primaryStyle = primaryId ? getTableStyle(cfg, primaryId) : null
  const multi = selIds.length > 1

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
          <button onClick={() => setSelectedIds(selectedIds.size === rawTables.length ? new Set() : new Set(rawTables.map(t => t.id)))} style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: `1px solid ${selectedIds.size === rawTables.length && rawTables.length > 0 ? PURPLE : 'var(--line)'}`, background: selectedIds.size === rawTables.length && rawTables.length > 0 ? `${PURPLE}14` : 'var(--surface)', color: selectedIds.size === rawTables.length && rawTables.length > 0 ? PURPLE : 'var(--ink-2)', cursor: 'pointer' }}>
            {selectedIds.size === rawTables.length && rawTables.length > 0 ? 'Quitar selección' : 'Seleccionar todas'}
          </button>
          <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>
            Arrastra las mesas para moverlas · dibuja un rectángulo en el salón para seleccionar varias
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Toggle: usar esta distribución real en el POS (Mesas) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: F, fontSize: '0.74rem', fontWeight: 600, color: 'var(--ink-2)', userSelect: 'none' }}>
            <span
              onClick={() => { setCfg(prev => ({ ...prev, enabled: !prev.enabled })); setSaved(false) }}
              style={{ width: 40, height: 23, borderRadius: 999, background: cfg.enabled ? PURPLE : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0, display: 'inline-block' }}
            >
              <span style={{ position: 'absolute', top: 3, left: cfg.enabled ? 20 : 3, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
            </span>
            Usar esta distribución en el POS
          </label>
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
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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

        {/* Marquee (rectángulo de selección) */}
        {marquee && (
          <div style={{
            position: 'absolute',
            left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
            border: `1.5px solid ${PURPLE}`, background: `${PURPLE}12`, borderRadius: 4,
            zIndex: 80, pointerEvents: 'none',
          }} />
        )}

        {/* Tables */}
        {rawTables.map(table => {
          const pos = positions.get(table.id) || { x: 0, y: 0 }
          const style = getTableStyle(cfg, table.id)
          const isSelected = selectedIds.has(table.id)
          const isDragging = !!dragging?.ids.includes(table.id)
          const color = table.sector_id ? (sectorColor.get(table.sector_id) || 'var(--ink-3)') : 'var(--ink-3)'
          const label = table.label || String(table.number)

          return (
            <div
              key={table.id}
              onPointerDown={(e) => handleTablePointerDown(table.id, e)}
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
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isDragging ? 'none' : 'box-shadow .15s',
                boxShadow: isSelected ? `0 0 0 3px ${PURPLE}40` : isDragging ? '0 8px 24px rgba(0,0,0,.18)' : '0 2px 8px rgba(0,0,0,.06)',
                zIndex: isDragging ? 100 : isSelected ? 50 : 10,
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

      {/* Propiedades de la(s) mesa(s) seleccionada(s) */}
      {primaryTable && primaryStyle && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: F, fontSize: '0.78rem', fontWeight: 800, color: 'var(--ink)' }}>
            {multi ? `${selIds.length} mesas seleccionadas` : (primaryTable.label || `Mesa ${primaryTable.number}`)}
          </div>

          {/* Shape */}
          <div>
            <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }}>Forma</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {SHAPES.map(s => (
                <button
                  key={s}
                  onClick={() => applyToSelected({ shape: s, ...(s === 'rect' ? { w: 90, h: 56 } : s === 'square' ? { w: 64, h: 64 } : { w: 64, h: 64 }) })}
                  style={{
                    fontFamily: F, fontSize: '0.7rem', fontWeight: 600,
                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    border: primaryStyle.shape === s ? `2px solid ${PURPLE}` : '1px solid var(--line)',
                    background: primaryStyle.shape === s ? `${PURPLE}14` : 'var(--surface)',
                    color: primaryStyle.shape === s ? PURPLE : 'var(--ink-2)',
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
              Tamaño: {primaryStyle.w} × {primaryStyle.h}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="range" min={MIN_SIZE} max={140} value={primaryStyle.w}
                onChange={e => applyToSelected({ w: +e.target.value, ...(primaryStyle.shape !== 'rect' ? { h: +e.target.value } : {}) })}
                style={{ flex: 1, accentColor: PURPLE }} />
              {primaryStyle.shape === 'rect' && (
                <input type="range" min={MIN_SIZE} max={140} value={primaryStyle.h}
                  onChange={e => applyToSelected({ h: +e.target.value })}
                  style={{ flex: 1, accentColor: PURPLE }} />
              )}
            </div>
          </div>

          {/* Rotation */}
          <div>
            <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }}>
              Rotacion: {primaryStyle.rotation}°
            </span>
            <input type="range" min={0} max={360} step={15} value={primaryStyle.rotation}
              onChange={e => applyToSelected({ rotation: +e.target.value })}
              style={{ width: '100%', accentColor: PURPLE }} />
          </div>
        </div>
      )}
    </div>
  )
}
