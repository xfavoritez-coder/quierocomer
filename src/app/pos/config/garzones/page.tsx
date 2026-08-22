'use client'

import { useState } from 'react'
import { usePosSync, useStaff, setRestaurantId, setUserId, saveGarzon, deleteGarzon, seedDefaultGarzones } from '@/lib/pos'
import PosHeader from '../../components/PosHeader'
import { usePosNav } from '../../lib/usePosNav'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

export default function GarzonesConfigPage() {
  const navigate = usePosNav()
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const garzones = useStaff(TEST_RESTAURANT_ID)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
    seedDefaultGarzones(TEST_RESTAURANT_ID)
  })

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (garzones.some(g => g.name.toLowerCase() === name.toLowerCase())) return
    setSaving(true)
    await saveGarzon(TEST_RESTAURANT_ID, name)
    setNewName('')
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deleteGarzon(id)
  }

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 20, marginBottom: 20, boxShadow: 'var(--sh-1)' }
  const eyebrow: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--ink-3)', marginBottom: 14 }

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Configuración"
        subtitle="Garzones"
        syncing={syncing}
        onBack={() => navigate('/pos')}
      />

      <div className="pos-scroll">
        <div style={{ padding: '20px 20px 60px', maxWidth: 480, margin: '0 auto' }}>

          <div style={card}>
            <div style={eyebrow}>Agregar garzón</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                placeholder="Nombre del garzón"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 15, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none' }}
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || saving}
                style={{ padding: '11px 18px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', opacity: !newName.trim() ? 0.5 : 1 }}
              >
                Agregar
              </button>
            </div>
          </div>

          <div style={{ ...eyebrow, marginBottom: 12 }}>
            Garzones · {garzones.length}
          </div>

          {garzones.length === 0 ? (
            <div className="pos-empty" style={{ minHeight: 120 }}>
              <p>Sin garzones. Agrega uno arriba.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {garzones.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--sh-1)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--amber-tint)', display: 'grid', placeItems: 'center', flexShrink: 0, marginRight: 12 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--amber-press)' }}>
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{g.name}</span>
                  <button
                    onClick={() => handleDelete(g.id)}
                    style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-3)' }}
                    title="Eliminar garzón"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
