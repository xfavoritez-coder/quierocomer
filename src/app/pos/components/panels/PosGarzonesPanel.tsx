'use client'

import { useState } from 'react'
import { usePosSync, useStaff, setRestaurantId, setUserId, saveStaffMember, deleteGarzon, seedDefaultGarzones } from '@/lib/pos'
import type { StaffRole } from '@/lib/pos/types'

const TEST_USER_ID = 'pos-garzon'

const ROLES: { value: StaffRole; label: string; color: string; bg: string }[] = [
  { value: 'garzon',   label: 'Garzón',         color: 'var(--amber-press)', bg: 'var(--amber-tint)' },
  { value: 'cocinero', label: 'Cocinero',        color: '#2563eb',            bg: '#eff6ff' },
  { value: 'cajero',   label: 'Cajero',          color: '#16a34a',            bg: '#f0fdf4' },
  { value: 'admin',    label: 'Administrador',   color: '#7c3aed',            bg: '#f5f3ff' },
]

function RoleBadge({ role }: { role: StaffRole }) {
  const r = ROLES.find(r => r.value === role) ?? ROLES[0]
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: r.bg, color: r.color, flexShrink: 0 }}>
      {r.label}
    </span>
  )
}

export default function PosGarzonesPanel({ restaurantId, title, onBack }: { restaurantId: string; title?: string; onBack?: () => void; onDone?: () => void }) {
  const { syncing } = usePosSync(restaurantId)
  const staff = useStaff(restaurantId)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<StaffRole>('garzon')
  const [saving, setSaving] = useState(false)

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
    seedDefaultGarzones(restaurantId)
  })

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    await saveStaffMember(restaurantId, name, newRole)
    setNewName('')
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await deleteGarzon(id)
  }

  void syncing

  return (
    <div className="pos-scroll">
      <div style={{ padding: '20px 16px 60px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {onBack && (
              <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p>
          </div>
        )}

        {/* Add form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Agregar usuario</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              placeholder="Nombre"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: '0.9rem', fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as StaffRole)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: '0.9rem', fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', cursor: 'pointer' }}
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || saving}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--sans)', opacity: !newName.trim() ? 0.5 : 1, flexShrink: 0 }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        {/* Staff list */}
        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          Usuarios · {staff.length}
        </div>

        {staff.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 120 }}>
            <p>Sin usuarios. Agrega uno arriba.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {staff.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: ROLES.find(r => r.value === s.role)?.bg ?? 'var(--amber-tint)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: ROLES.find(r => r.value === s.role)?.color ?? 'var(--amber-press)' }}>
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                </div>
                <RoleBadge role={s.role} />
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}
                  title="Eliminar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
