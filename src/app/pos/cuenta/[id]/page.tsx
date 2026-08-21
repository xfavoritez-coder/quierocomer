'use client'

import { useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  useAccount, usePosSync,
  setRestaurantId, setUserId,
  voidItem, requestBill, voidAccount,
} from '@/lib/pos'
import PosHeader from '../../components/PosHeader'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

export default function CuentaPage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.id as string
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const account = useAccount(accountId)

  const [voidModal, setVoidModal] = useState<{ itemId: string; name: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [requestingBill, setRequestingBill] = useState(false)

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  const handleRequestBill = useCallback(async () => {
    if (!accountId || account?.status === 'cuenta_pedida') return
    setRequestingBill(true)
    try {
      await requestBill({ account_id: accountId })
      toast.success('Cuenta pedida')
    } catch (err) {
      toast.error('Error: ' + String(err))
    } finally {
      setRequestingBill(false)
    }
  }, [accountId, account?.status])

  const handleVoidItem = useCallback(async () => {
    if (!voidModal || !accountId) return
    if (!voidReason.trim()) { toast.error('Escribe un motivo'); return }
    setVoiding(true)
    try {
      await voidItem({ account_id: accountId, item_id: voidModal.itemId, reason: voidReason.trim() })
      toast.success('Ítem anulado')
      setVoidModal(null)
      setVoidReason('')
    } catch (err) {
      toast.error('Error: ' + String(err))
    } finally {
      setVoiding(false)
    }
  }, [voidModal, accountId, voidReason])

  const handleVoidAccount = useCallback(async () => {
    if (!accountId) return
    if (!confirm('¿Anular esta cuenta? Esta acción queda registrada.')) return
    try {
      await voidAccount({ account_id: accountId, reason: 'Anulada desde vista de cuenta' })
      toast.success('Cuenta anulada')
      router.push('/pos')
    } catch (err) {
      toast.error('Error: ' + String(err))
    }
  }, [accountId, router])

  if (!account) {
    return (
      <div className="pos-shell">
        <PosHeader mode="back" eyebrow="Cuenta" subtitle="Cargando..." onBack={() => router.push('/pos')} syncing={syncing} />
        <div className="pos-empty" style={{ flex: 1 }}>
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
        </div>
      </div>
    )
  }

  const accountName = account.type === 'mesa'
    ? `Mesa ${account.table_number}`
    : account.type === 'mostrador' ? 'Mostrador'
    : `Retiro · ${account.customer_name}`

  const statusLabel: Record<string, string> = {
    abierta: 'Abierta',
    con_pedidos: 'Con pedidos',
    cuenta_pedida: 'Cuenta pedida',
    pagada_parcial: 'Pago parcial',
    cerrada: 'Cerrada',
    anulada: 'Anulada',
  }

  const activeItems = account.items.filter(i => !i.voided)
  const isClosed = account.status === 'cerrada' || account.status === 'anulada'

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow={accountName}
        subtitle={statusLabel[account.status] ?? account.status}
        syncing={syncing}
        onBack={() => router.push('/pos')}
        rightSlot={
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 17, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            ${account.total.toLocaleString('es-CL')}
          </span>
        }
      />

      <div className="pos-scroll">
        <div style={{ padding: '20px 20px 120px' }}>

          {/* ── Rondas ── */}
          {account.rounds.length === 0 ? (
            <div className="pos-empty" style={{ minHeight: 160 }}>
              <div className="ring">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
              </div>
              <p>Sin pedidos aún.<br/>Toca &quot;Nueva ronda&quot; para agregar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {account.rounds.map((round, ri) => (
                <div key={round.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden', boxShadow: 'var(--sh-1)' }}>
                  {/* Round header */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sunk)' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                      Ronda {ri + 1}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                      {new Date(round.sent_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Items */}
                  {round.items.map(item => {
                    const isVoided = account.items.find(i => i.id === item.id)?.voided
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        padding: '12px 16px', gap: 12,
                        borderBottom: '1px solid var(--line)',
                        opacity: isVoided ? 0.4 : 1,
                        background: isVoided ? 'var(--sunk)' : undefined,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, color: 'var(--amber-press)', width: 22 }}>
                              {item.quantity}×
                            </span>
                            <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)', textDecoration: isVoided ? 'line-through' : undefined }}>
                              {item.dish_name}
                            </span>
                          </div>
                          {item.modifiers?.length > 0 && (
                            <div style={{ marginLeft: 30, marginTop: 3, fontSize: 12, color: 'var(--ink-3)' }}>
                              {item.modifiers.map(m => m.option_name).join(' · ')}
                            </div>
                          )}
                          {item.note && (
                            <div style={{ marginLeft: 30, marginTop: 3, fontSize: 12, color: 'var(--amber-press)', fontWeight: 500 }}>
                              !! {item.note}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                            ${(item.quantity * item.unit_price).toLocaleString('es-CL')}
                          </span>
                          {!isVoided && !isClosed && (
                            <button
                              onClick={() => { setVoidModal({ itemId: item.id, name: item.dish_name }); setVoidReason('') }}
                              style={{ minWidth: 32, minHeight: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-3)' }}
                              title="Anular ítem"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Anular cuenta */}
          {!isClosed && (
            <button
              onClick={handleVoidAccount}
              style={{ marginTop: 24, width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >
              Anular cuenta
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      {!isClosed && (
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => location.assign(`/pos/comandero?cuenta=${accountId}`)}
            style={{ flex: 1, padding: '13px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', color: 'var(--ink)' }}
          >
            + Nueva ronda
          </button>

          {account.status !== 'cuenta_pedida' && activeItems.length > 0 && (
            <button
              onClick={handleRequestBill}
              disabled={requestingBill}
              style={{ padding: '13px 18px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', color: 'var(--ink)', opacity: requestingBill ? 0.6 : 1 }}
            >
              Pedir cuenta
            </button>
          )}

          {activeItems.length > 0 && (
            <button
              onClick={() => location.assign(`/pos/cobro?cuenta=${accountId}`)}
              style={{ padding: '13px 18px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >
              Cobrar
            </button>
          )}
        </div>
      )}

      {/* ── Void item modal ── */}
      {voidModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(27,26,23,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Anular ítem</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>{voidModal.name}</div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Motivo</label>
            <input
              autoFocus
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder="Ej: Error de pedido, cliente cambió de opinión..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', marginBottom: 16 }}
              onKeyDown={e => e.key === 'Enter' && handleVoidItem()}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setVoidModal(null)} style={{ flex: 1, padding: 13, borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
                Cancelar
              </button>
              <button onClick={handleVoidItem} disabled={voiding} style={{ flex: 1, padding: 13, borderRadius: 'var(--r-btn)', border: 0, background: '#e05252', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', opacity: voiding ? 0.7 : 1 }}>
                {voiding ? 'Anulando...' : 'Anular ítem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
