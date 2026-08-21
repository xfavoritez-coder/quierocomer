'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTables, usePosSync, setRestaurantId, setUserId } from '@/lib/pos'
import { saveTables } from '@/lib/pos/tables'
import PosHeader from '../../components/PosHeader'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

export default function MesasConfigPage() {
  const router = useRouter()
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const tables = useTables(TEST_RESTAURANT_ID)
  const [quickN, setQuickN] = useState('10')
  const [saving, setSaving] = useState(false)
  const [addNumber, setAddNumber] = useState('')

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  const handleQuickCreate = async () => {
    const n = parseInt(quickN)
    if (!n || n < 1 || n > 50) return
    setSaving(true)
    await saveTables(TEST_RESTAURANT_ID, Array.from({ length: n }, (_, i) => ({ number: i + 1 })))
    setSaving(false)
  }

  const handleAddSingle = async () => {
    const num = parseInt(addNumber)
    if (!num || num < 1) return
    if (tables.some(t => t.number === num)) return
    const updated = [...tables.map(t => ({ number: t.number, label: t.label })), { number: num }]
      .sort((a, b) => a.number - b.number)
    await saveTables(TEST_RESTAURANT_ID, updated)
    setAddNumber('')
  }

  const handleDelete = async (number: number) => {
    const remaining = tables.filter(t => t.number !== number)
    await saveTables(TEST_RESTAURANT_ID, remaining.map(t => ({ number: t.number, label: t.label })))
  }

  const handleClearAll = async () => {
    if (!confirm('¿Eliminar todas las mesas?')) return
    await saveTables(TEST_RESTAURANT_ID, [])
  }

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Configuración"
        subtitle="Mesas"
        syncing={syncing}
        onBack={() => router.push('/pos')}
      />

      <div className="pos-scroll">
        <div style={{ padding: '20px 20px 60px', maxWidth: 560, margin: '0 auto' }}>

          {/* Creación rápida */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 20, marginBottom: 20, boxShadow: 'var(--sh-1)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>
              Creación rápida
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Crear mesas del 1 al</span>
              <input
                type="number"
                min={1}
                max={50}
                value={quickN}
                onChange={e => setQuickN(e.target.value)}
                style={{ width: 70, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 15, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', textAlign: 'center' }}
              />
              <button
                onClick={handleQuickCreate}
                disabled={saving}
                style={{ flex: 1, padding: '11px 16px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Guardando...' : 'Crear'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, marginBottom: 0 }}>
              Reemplaza las mesas actuales.
            </p>
          </div>

          {/* Agregar mesa individual */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 20, marginBottom: 20, boxShadow: 'var(--sh-1)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>
              Agregar mesa
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="number"
                min={1}
                value={addNumber}
                onChange={e => setAddNumber(e.target.value)}
                placeholder="Nro."
                style={{ width: 90, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 15, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', textAlign: 'center' }}
                onKeyDown={e => e.key === 'Enter' && handleAddSingle()}
              />
              <button
                onClick={handleAddSingle}
                disabled={!addNumber}
                style={{ flex: 1, padding: '11px 16px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', color: 'var(--ink)', opacity: !addNumber ? 0.5 : 1 }}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Lista de mesas */}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 10, marginBottom: 20 }}>
                {tables.map(table => (
                  <div key={table.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', boxShadow: 'var(--sh-1)' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>{table.number}</span>
                    <button
                      onClick={() => handleDelete(table.number)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }}
                      title="Eliminar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>

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
