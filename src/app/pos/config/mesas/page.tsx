'use client'

import { useState } from 'react'
import { useTables, useSectors, usePosSync, setRestaurantId, setUserId } from '@/lib/pos'
import { saveTables, saveSectors, updateTableSector, updateTableLabel } from '@/lib/pos'
import PosHeader from '../../components/PosHeader'
import { usePosNav } from '../../lib/usePosNav'
import { usePosRestaurant } from '../../lib/usePosRestaurant'

const TEST_USER_ID = 'pos-garzon'

export default function MesasConfigPage() {
  const navigate = usePosNav()
  const { restaurantId } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const tables = useTables(restaurantId)
  const sectors = useSectors(restaurantId)

  const [quickN, setQuickN] = useState('10')
  const [quickPrefix, setQuickPrefix] = useState('')
  const [quickSector, setQuickSector] = useState('')
  const [saving, setSaving] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addSector, setAddSector] = useState('')
  const [newSectorName, setNewSectorName] = useState('')
  const [editingLabel, setEditingLabel] = useState<Record<string, string>>({})

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
  })

  const handleAddSector = async () => {
    const name = newSectorName.trim()
    if (!name || sectors.some(s => s.name.toLowerCase() === name.toLowerCase())) return
    await saveSectors(restaurantId, [
      ...sectors.map((s, i) => ({ name: s.name, position: i })),
      { name, position: sectors.length },
    ])
    setNewSectorName('')
  }

  const handleDeleteSector = async (sectorId: string) => {
    const tablesInSector = tables.filter(t => t.sector_id === sectorId)
    await Promise.all(tablesInSector.map(t => updateTableSector(t.id, null)))
    await saveSectors(
      restaurantId,
      sectors.filter(s => s.id !== sectorId).map((s, i) => ({ name: s.name, position: i }))
    )
  }

  const handleQuickCreate = async () => {
    const n = parseInt(quickN)
    if (!n || n < 1 || n > 99) return
    setSaving(true)
    const sectorId = quickSector || undefined
    const prefix = quickPrefix.trim()
    await saveTables(
      restaurantId,
      Array.from({ length: n }, (_, i) => ({
        number: i + 1,
        label: prefix ? `${prefix}${i + 1}` : undefined,
        sector_id: sectorId,
      }))
    )
    setSaving(false)
  }

  const handleAddSingle = async () => {
    const label = addLabel.trim()
    if (!label) return
    // Use next available number for ordering
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0)
    // Don't allow duplicate labels
    if (tables.some(t => (t.label || String(t.number)) === label)) return
    const updated = [
      ...tables.map(t => ({ number: t.number, label: t.label, sector_id: t.sector_id })),
      { number: maxNum + 1, label: /^\d+$/.test(label) ? undefined : label, sector_id: addSector || undefined },
    ]
    // If pure number, use it as the number and no label
    if (/^\d+$/.test(label)) {
      const num = parseInt(label)
      if (tables.some(t => t.number === num && !t.label)) return
      updated[updated.length - 1] = { number: num, label: undefined, sector_id: addSector || undefined }
    }
    await saveTables(restaurantId, updated.sort((a, b) => a.number - b.number))
    setAddLabel('')
  }

  const handleDelete = async (tableId: string) => {
    const remaining = tables.filter(t => t.id !== tableId)
    await saveTables(restaurantId, remaining.map(t => ({ number: t.number, label: t.label, sector_id: t.sector_id })))
  }

  const handleClearAll = async () => {
    if (!confirm('¿Eliminar todas las mesas?')) return
    await saveTables(restaurantId, [])
  }

  const handleSectorChange = async (tableId: string, sectorId: string) => {
    await updateTableSector(tableId, sectorId || null)
  }

  const handleLabelBlur = async (tableId: string) => {
    const val = editingLabel[tableId]
    if (val === undefined) return
    await updateTableLabel(tableId, val.trim())
    setEditingLabel(prev => { const n = { ...prev }; delete n[tableId]; return n })
  }

  // Group by sector for display
  const sectorGroups = [
    ...sectors.map(s => ({
      id: s.id,
      name: s.name,
      tables: tables.filter(t => t.sector_id === s.id),
    })),
    { id: '', name: 'Sin sector', tables: tables.filter(t => !t.sector_id) },
  ].filter(g => g.tables.length > 0 || (g.id === '' && sectors.length === 0))

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 20, marginBottom: 20, boxShadow: 'var(--sh-1)' }
  const eyebrow: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--ink-3)', marginBottom: 14 }
  const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none' }
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
  const btn = (primary = false): React.CSSProperties => ({
    padding: '11px 16px', borderRadius: 'var(--r-btn)', border: primary ? 0 : '1px solid var(--line)',
    background: primary ? 'var(--amber)' : 'var(--sunk)', color: primary ? '#fff' : 'var(--ink)',
    fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)',
  })

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Configuración"
        subtitle="Mesas"
        syncing={syncing}
        onBack={() => navigate('/pos')}
      />

      <div className="pos-scroll">
        <div style={{ padding: '20px 20px 60px', maxWidth: 560, margin: '0 auto' }}>

          {/* ── Sectores ─────────────────────────────────────── */}
          <div style={card}>
            <div style={eyebrow}>Sectores</div>
            {sectors.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {sectors.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 10, padding: '6px 12px' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{tables.filter(t => t.sector_id === s.id).length} mesas</span>
                    <button onClick={() => handleDeleteSector(s.id)} style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', padding: 0 }} title="Eliminar sector">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Ej: Salón, Terraza, Bar..." value={newSectorName} onChange={e => setNewSectorName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSector()} style={{ ...inp, flex: 1 }} />
              <button onClick={handleAddSector} disabled={!newSectorName.trim()} style={{ ...btn(true), opacity: !newSectorName.trim() ? 0.5 : 1 }}>Agregar</button>
            </div>
          </div>

          {/* ── Creación rápida ──────────────────────────────── */}
          <div style={card}>
            <div style={eyebrow}>Creación rápida</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Crear</span>
              <input
                type="number" min={1} max={99} value={quickN} onChange={e => setQuickN(e.target.value)}
                style={{ ...inp, width: 64, textAlign: 'center', fontFamily: 'var(--mono)' }}
              />
              <span style={{ fontSize: 14, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>mesas con prefijo</span>
              <input
                placeholder="A, T-, (vacío = números)"
                value={quickPrefix}
                onChange={e => setQuickPrefix(e.target.value)}
                style={{ ...inp, width: 140 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sectors.length > 0 && (
                <select value={quickSector} onChange={e => setQuickSector(e.target.value)} style={{ ...sel, flex: 1 }}>
                  <option value="">Sin sector</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <button onClick={handleQuickCreate} disabled={saving} style={{ ...btn(true), flex: 1, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : quickPrefix.trim() ? `Crear ${quickPrefix.trim()}1…${quickPrefix.trim()}${quickN}` : `Crear 1…${quickN}`}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, marginBottom: 0 }}>Reemplaza las mesas actuales.</p>
          </div>

          {/* ── Agregar mesa individual ──────────────────────── */}
          <div style={card}>
            <div style={eyebrow}>Agregar mesa</div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
              Puede ser un número (1, 12) o letra+número (A1, T-3, VIP, Barra).
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Ej: A1, T-3, Barra, 12"
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSingle()}
                style={{ ...inp, flex: 1, minWidth: 120 }}
              />
              {sectors.length > 0 && (
                <select value={addSector} onChange={e => setAddSector(e.target.value)} style={{ ...sel, flex: 1 }}>
                  <option value="">Sin sector</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <button onClick={handleAddSingle} disabled={!addLabel.trim()} style={{ ...btn(false), opacity: !addLabel.trim() ? 0.5 : 1 }}>Agregar</button>
            </div>
          </div>

          {/* ── Lista de mesas ───────────────────────────────── */}
          <div style={{ ...eyebrow, marginBottom: 12 }}>
            Mesas configuradas {tables.length > 0 && `· ${tables.length}`}
          </div>

          {tables.length === 0 ? (
            <div className="pos-empty" style={{ minHeight: 120 }}>
              <div className="ring">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              </div>
              <p>Sin mesas. Usa la creación rápida arriba.</p>
            </div>
          ) : (
            <>
              {sectorGroups.map(group => (
                <div key={group.id} style={{ marginBottom: 20 }}>
                  {sectors.length > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 10 }}>
                      {group.name} · {group.tables.length}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 10 }}>
                    {group.tables.map(table => {
                      const displayLabel = table.label || String(table.number)
                      const editVal = editingLabel[table.id]
                      return (
                        <div key={table.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', boxShadow: 'var(--sh-1)' }}>
                          {/* Label editable */}
                          <input
                            value={editVal ?? displayLabel}
                            onChange={e => setEditingLabel(prev => ({ ...prev, [table.id]: e.target.value }))}
                            onBlur={() => handleLabelBlur(table.id)}
                            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            style={{
                              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: editVal !== undefined ? 16 : (displayLabel.length > 3 ? 14 : 18),
                              color: 'var(--ink)', background: 'transparent', border: editVal !== undefined ? '1px solid var(--amber)' : '1px solid transparent',
                              borderRadius: 6, textAlign: 'center', width: '100%', padding: '2px 4px', outline: 'none', cursor: 'text',
                            }}
                            title="Editar identificador de mesa"
                          />
                          {sectors.length > 0 && (
                            <select
                              value={table.sector_id ?? ''}
                              onChange={e => handleSectorChange(table.id, e.target.value)}
                              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', cursor: 'pointer', width: '100%', fontFamily: 'var(--sans)', outline: 'none' }}
                            >
                              <option value="">Sin sector</option>
                              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                          <button
                            onClick={() => handleDelete(table.id)}
                            style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, display: 'grid', placeItems: 'center', borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }}
                            title="Eliminar"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleClearAll}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)' }}
              >
                Eliminar todas las mesas
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
