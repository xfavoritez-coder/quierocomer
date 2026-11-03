'use client'

// ─────────────────────────────────────────────────────────────────────────────
//  /pos/test-seed  —  Página de datos ficticios para desarrollo/QA.
//  Corre en el browser: usa openAccount() directamente sobre Dexie/IndexedDB.
//  NO APARECE en producción (la lógica solo aplica en localhost).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  openAccount,
  voidAccount,
  setRestaurantId,
  setUserId,
  useTables,
} from '@/lib/pos'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import { usePosNav } from '../lib/usePosNav'
import PosHeader from '../components/PosHeader'

const SEED_TAG = 'seed-test-mesa'

const FAKE_MESAS = [
  { covers: 4, garzon: 'Rodrigo', items: 'Suprema 40 piezas × 1, Sake caliente × 2' },
  { covers: 2, garzon: 'Camila', items: 'Miércoles Mix × 1, Agua mineral × 1' },
  { covers: 6, garzon: 'Rodrigo', items: 'Deluxe 60 piezas × 2, Coca-Cola × 3' },
]

export default function TestSeedPage() {
  const navigate = usePosNav()
  const { restaurantId } = usePosRestaurant()
  const tables = useTables(restaurantId)
  const [seededIds, setSeededIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (restaurantId) {
      setRestaurantId(restaurantId)
      setUserId('seed-test')
    }
  }, [restaurantId])

  // Recuperar IDs guardados en sessionStorage para poder borrarlos
  useEffect(() => {
    const saved = sessionStorage.getItem('pos_seed_account_ids')
    if (saved) setSeededIds(JSON.parse(saved))
  }, [])

  const saveIds = (ids: string[]) => {
    setSeededIds(ids)
    sessionStorage.setItem('pos_seed_account_ids', JSON.stringify(ids))
  }

  const handleSeed = async () => {
    if (tables.length === 0) { setMsg('No hay mesas configuradas. Ve a Configurar mesas primero.'); return }
    setBusy(true)
    setMsg('')
    const ids: string[] = []
    // Tomar las primeras 3 mesas disponibles
    const targets = tables.slice(0, Math.min(3, tables.length))
    for (let i = 0; i < targets.length; i++) {
      const table = targets[i]
      const fake = FAKE_MESAS[i]
      const id = uuidv4()
      await openAccount({
        account_id: id,
        account_type: 'mesa',
        table_id: table.id,
        table_number: table.number,
        table_label: table.label ?? `Mesa ${table.number}`,
        covers: fake.covers,
        opened_by_name: fake.garzon,
      })
      ids.push(id)
    }
    saveIds(ids)
    setMsg(`✅ ${ids.length} mesas abiertas en: ${tables.slice(0, ids.length).map(t => t.label ?? `Mesa ${t.number}`).join(', ')}`)
    setBusy(false)
  }

  const handleDelete = async () => {
    if (seededIds.length === 0) { setMsg('Nada que borrar.'); return }
    setBusy(true)
    for (const id of seededIds) {
      await voidAccount({ account_id: id, reason: 'seed-test deleted' })
    }
    saveIds([])
    setMsg(`🗑  ${seededIds.length} mesas anuladas.`)
    setBusy(false)
  }

  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0', borderBottom: '1px solid var(--line)', fontSize: 14,
    color: 'var(--ink-2)',
  }

  return (
    <div className="pos-root" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <PosHeader mode="back" eyebrow="Seed de prueba" subtitle="Solo localhost" onBack={() => navigate('/pos')} />
      <div className="pos-scroll">
        <div className="pos-pad" style={{ maxWidth: 480, margin: '0 auto' }}>

          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
            Solo para desarrollo. No usar en producción.
          </div>

          {/* Mesas disponibles */}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>
            Mesas configuradas ({tables.length})
          </div>
          {tables.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
              No hay mesas. Configúralas en{' '}
              <button onClick={() => navigate('/pos/config/mesas')} style={{ color: 'var(--amber-press)', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>
                Configurar mesas →
              </button>
            </p>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '0 14px', marginBottom: 20 }}>
              {tables.slice(0, 6).map((t, i) => (
                <div key={t.id} style={row}>
                  <span>{t.label ?? `Mesa ${t.number}`}</span>
                  {i < 3 && <span style={{ fontSize: 12, color: 'var(--amber-press)', fontWeight: 600 }}>← se abrirá ({FAKE_MESAS[i].covers} pax · {FAKE_MESAS[i].garzon})</span>}
                </div>
              ))}
              {tables.length > 6 && <div style={{ ...row, borderBottom: 0, color: 'var(--ink-3)', fontSize: 12 }}>+{tables.length - 6} más…</div>}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleSeed}
              disabled={busy || tables.length === 0}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'var(--sans)' }}
            >
              {busy ? 'Abriendo mesas…' : `Abrir ${Math.min(3, tables.length)} mesas de prueba`}
            </button>
            {seededIds.length > 0 && (
              <button
                onClick={handleDelete}
                disabled={busy}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1px solid #fca5a5', background: 'rgba(239,68,68,.06)', color: '#dc2626', fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'var(--sans)' }}
              >
                {busy ? 'Anulando…' : `Anular ${seededIds.length} mesas de prueba`}
              </button>
            )}
          </div>

          {msg && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--sunk)', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>
              {msg}
            </div>
          )}

          <div style={{ marginTop: 32, padding: '14px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 8 }}>
              Pedidos retiro/delivery
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Los 10 pedidos ficticios de retiro y delivery se crean con el script de servidor:<br />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--sunk)', padding: '2px 6px', borderRadius: 4 }}>
                npx tsx scripts/_seed-kojo-recoleta-test.ts
              </code><br /><br />
              Para borrarlos:<br />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--sunk)', padding: '2px 6px', borderRadius: 4 }}>
                npx tsx scripts/_seed-kojo-recoleta-test.ts --delete
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
