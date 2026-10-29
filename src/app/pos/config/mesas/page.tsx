'use client'

import { useState } from 'react'
import { useTables, useSectors, usePosSync, setRestaurantId, setUserId } from '@/lib/pos'
import { saveSectors, updateTableSector, updateTableLabel, addTables, addCustomTable, removeTable, saveTables, nextTableNumber } from '@/lib/pos'
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

  // Crear mesas (aditivo)
  const [bulkCount, setBulkCount] = useState('10')
  const [bulkPrefix, setBulkPrefix] = useState('')
  const [bulkSector, setBulkSector] = useState('')
  // Alta individual con nombre propio
  const [customLabel, setCustomLabel] = useState('')
  const [customSector, setCustomSector] = useState('')
  // Sectores
  const [newSectorName, setNewSectorName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingLabel, setEditingLabel] = useState<Record<string, string>>({})

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
  })

  // ── Sectores ───────────────────────────────────────────────
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
    if (bulkSector === sectorId) setBulkSector('')
    if (customSector === sectorId) setCustomSector('')
  }

  // ── Crear mesas (aditivo, lee la BD fresca) ────────────────
  const prefix = bulkPrefix.trim()
  const count = parseInt(bulkCount, 10) || 0
  const startNum = nextTableNumber(tables, prefix)
  const firstId = `${prefix}${startNum}`
  const lastId = `${prefix}${startNum + Math.max(count, 1) - 1}`
  const sectorName = (id: string) => sectors.find(s => s.id === id)?.name

  const handleBulkAdd = async () => {
    if (count < 1 || count > 99) return
    setSaving(true)
    await addTables(restaurantId, { count, prefix: bulkPrefix, sectorId: bulkSector || null })
    setSaving(false)
  }

  // ── Alta individual (nombre propio) ────────────────────────
  const handleAddCustom = async () => {
    if (!customLabel.trim()) return
    await addCustomTable(restaurantId, customLabel, customSector || null)
    setCustomLabel('')
  }

  // ── Edición / borrado ──────────────────────────────────────
  const handleDelete = async (tableId: string) => {
    await removeTable(restaurantId, tableId)
  }

  const handleClearAll = async () => {
    if (!confirm('¿Eliminar TODAS las mesas? Esta acción no se puede deshacer.')) return
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

  // Agrupar por sector para la lista
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
  const fieldLabel: React.CSSProperties = { fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6, display: 'block' }
  const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }
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
            <div style={eyebrow}>1 · Sectores</div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: -6, marginBottom: 12 }}>
              Zonas del local (Salón, Terraza…). Créalas primero para asignarles mesas.
            </p>
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

          {/* ── Crear mesas (por cantidad, aditivo) ──────────── */}
          <div style={card}>
            <div style={eyebrow}>2 · Crear mesas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={fieldLabel}>¿Cuántas?</label>
                <input type="number" min={1} max={99} value={bulkCount} onChange={e => setBulkCount(e.target.value)} style={{ ...inp, width: '100%', fontFamily: 'var(--mono)' }} />
              </div>
              <div>
                <label style={fieldLabel}>¿En qué sector?</label>
                <select value={bulkSector} onChange={e => setBulkSector(e.target.value)} style={{ ...sel, width: '100%' }}>
                  <option value="">Sin sector</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={fieldLabel}>Prefijo del nombre (opcional)</label>
                <input placeholder="Ej: T, Mesa, S — vacío = números 1, 2, 3…" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
            </div>

            {/* Vista previa */}
            {count > 0 && (
              <div style={{ background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: 'var(--ink-2)' }}>
                Se agregarán <strong>{count}</strong> mesa{count !== 1 ? 's' : ''}:{' '}
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink)' }}>{count === 1 ? firstId : `${firstId} – ${lastId}`}</span>
                {bulkSector ? <> en <strong>{sectorName(bulkSector)}</strong></> : ' sin sector'}.
              </div>
            )}

            <button onClick={handleBulkAdd} disabled={saving || count < 1} style={{ ...btn(true), width: '100%', opacity: saving || count < 1 ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Agregar mesas'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, marginBottom: 0 }}>
              Se <strong>suman</strong> a las que ya tienes (no borra nada). La numeración continúa sola y se omiten nombres repetidos.
            </p>
          </div>

          {/* ── Agregar una mesa con nombre propio ───────────── */}
          <div style={card}>
            <div style={eyebrow}>Agregar una suelta</div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: -6, marginBottom: 10 }}>
              Para nombres puntuales: un número (12) o texto (VIP, Barra, T-3).
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Ej: VIP, Barra, T-3, 12"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                style={{ ...inp, flex: 1, minWidth: 120 }}
              />
              {sectors.length > 0 && (
                <select value={customSector} onChange={e => setCustomSector(e.target.value)} style={{ ...sel, flex: 1 }}>
                  <option value="">Sin sector</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <button onClick={handleAddCustom} disabled={!customLabel.trim()} style={{ ...btn(false), opacity: !customLabel.trim() ? 0.5 : 1 }}>Agregar</button>
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
              <p>Sin mesas. Usa &ldquo;Crear mesas&rdquo; arriba.</p>
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
