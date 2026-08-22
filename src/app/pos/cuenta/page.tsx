'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  useAccount, usePosSync, useStaff,
  setRestaurantId, setUserId,
  voidItem, requestBill, voidAccount,
  updateAccountCovers, updateAccountGarzon,
} from '@/lib/pos'
import PosHeader from '../components/PosHeader'
import ProductPickerSheet from '../components/ProductPickerSheet'
import { usePosNav } from '../lib/usePosNav'
import { usePosRestaurant } from '../lib/usePosRestaurant'

const TEST_USER_ID = 'pos-garzon'

function CuentaPageInner() {
  const navigate = usePosNav()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('id') ?? ''
  const { restaurantId } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const account = useAccount(accountId)
  const garzones = useStaff(restaurantId)

  // Sheet / modal states
  const [showAddItem, setShowAddItem] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsModal, setSettingsModal] = useState<'comensales' | 'garzon' | null>(null)
  const [voidModal, setVoidModal] = useState<{ itemId: string; name: string } | null>(null)

  // Field states
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [requestingBill, setRequestingBill] = useState(false)
  const [coversInput, setCoversInput] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
  })

  const handleRequestBill = useCallback(async () => {
    if (!accountId || account?.status === 'cuenta_pedida') return
    setRequestingBill(true)
    try {
      await requestBill({ account_id: accountId })
    } catch (err) {
    } finally {
      setRequestingBill(false)
    }
  }, [accountId, account?.status])

  const handleVoidItem = useCallback(async () => {
    if (!voidModal || !accountId) return
    if (!voidReason.trim()) { return }
    setVoiding(true)
    try {
      await voidItem({ account_id: accountId, item_id: voidModal.itemId, reason: voidReason.trim() })
      setVoidModal(null)
      setVoidReason('')
    } catch (err) {
    } finally {
      setVoiding(false)
    }
  }, [voidModal, accountId, voidReason])

  const handleVoidAccount = useCallback(async () => {
    if (!accountId) return
    setShowSettings(false)
    if (!confirm('¿Anular esta cuenta? Esta acción queda registrada.')) return
    try {
      await voidAccount({ account_id: accountId, reason: 'Anulada desde vista de cuenta' })
      navigate('/pos')
    } catch (err) {
    }
  }, [accountId, navigate])

  const handleSaveCovers = useCallback(async () => {
    const n = parseInt(coversInput)
    if (!n || n < 1) { return }
    setSavingMeta(true)
    try {
      await updateAccountCovers(accountId, n)
      setSettingsModal(null)
    } catch (err) {
    } finally {
      setSavingMeta(false)
    }
  }, [accountId, coversInput])

  const handleChangeGarzon = useCallback(async (name: string) => {
    setSavingMeta(true)
    try {
      await updateAccountGarzon(accountId, name)
      setSettingsModal(null)
    } catch (err) {
    } finally {
      setSavingMeta(false)
    }
  }, [accountId])

  if (!account) {
    return (
      <div className="pos-shell">
        <PosHeader mode="back" eyebrow="Cuenta" subtitle="Cargando..." onBack={() => navigate('/pos')} syncing={syncing} />
        <div className="pos-empty" style={{ flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  const accountName = account.type === 'mesa'
    ? account.table_label || `Mesa ${account.table_number}`
    : account.type === 'retiro' || account.type === 'mostrador'
      ? `Para llevar${account.customer_name ? ` · ${account.customer_name}` : ''}`
      : account.type === 'delivery'
        ? `Delivery${account.customer_name ? ` · ${account.customer_name}` : ''}`
        : 'Cuenta'

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(() => timeSince(account.opened_at))
  useEffect(() => {
    const iv = setInterval(() => setElapsed(timeSince(account.opened_at)), 30_000)
    return () => clearInterval(iv)
  }, [account.opened_at])

  const activeItems = account.items.filter(i => !i.voided)
  const isClosed = account.status === 'cerrada' || account.status === 'anulada'

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow={accountName}
        syncing={syncing}
        onBack={() => navigate('/pos')}
        rightSlot={!isClosed ? (
          <button
            onClick={() => setShowSettings(true)}
            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--sunk)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-2)', minWidth: 44, minHeight: 44 }}
            title="Opciones de mesa"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        ) : undefined}
      />

      <div className="pos-scroll">
        <div style={{ padding: '20px 20px 120px' }}>
          {/* Info row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {account.status === 'cuenta_pedida' && (
              <InfoChip
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                accent
              >
                Cuenta solicitada
              </InfoChip>
            )}
            <InfoChip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}>
              Abierta hace {elapsed}
            </InfoChip>
            {account.covers && (
              <InfoChip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}>
                {account.covers} {account.covers === 1 ? 'comensal' : 'comensales'}
              </InfoChip>
            )}
            {account.opened_by_name && (
              <InfoChip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
                {account.opened_by_name}
              </InfoChip>
            )}
          </div>

          {account.rounds.length === 0 ? (
            <div className="pos-empty" style={{ minHeight: 160 }}>
              <div className="ring">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
              </div>
              <p>Sin pedidos aún.<br/>Toca &quot;Agregar ítem&quot; para empezar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {account.rounds.map((round, ri) => (
                <div key={round.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden', boxShadow: 'var(--sh-1)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sunk)' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Ronda {ri + 1}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                      {new Date(round.sent_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {round.items.map(item => {
                    const isVoided = account.items.find(i => i.id === item.id)?.voided
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 16px', gap: 12, borderBottom: '1px solid var(--line)', opacity: isVoided ? 0.4 : 1, background: isVoided ? 'var(--sunk)' : undefined }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, color: 'var(--amber-press)', width: 22 }}>{item.quantity}×</span>
                            <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)', textDecoration: isVoided ? 'line-through' : undefined }}>{item.dish_name}</span>
                          </div>
                          {item.modifiers?.length > 0 && (
                            <div style={{ marginLeft: 30, marginTop: 3, fontSize: 12, color: 'var(--ink-3)' }}>{item.modifiers.map(m => m.option_name).join(' · ')}</div>
                          )}
                          {item.note && (
                            <div style={{ marginLeft: 30, marginTop: 3, fontSize: 12, color: 'var(--amber-press)', fontWeight: 500 }}>!! {item.note}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                            ${(item.quantity * item.unit_price).toLocaleString('es-CL')}
                          </span>
                          {!isVoided && !isClosed && (
                            <button onClick={() => { setVoidModal({ itemId: item.id, name: item.dish_name }); setVoidReason('') }}
                              style={{ minWidth: 32, minHeight: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', cursor: 'pointer', color: 'var(--ink-3)' }}>
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
        </div>
      </div>

      {/* Bottom bar */}
      {!isClosed && (
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowAddItem(true)}
            style={{ flex: 1, padding: '13px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', boxShadow: '0 2px 4px rgba(222,124,0,.2),0 4px 12px rgba(222,124,0,.2)' }}
          >
            + Agregar ítem
          </button>
          {account.status !== 'cuenta_pedida' && activeItems.length > 0 && (
            <button onClick={handleRequestBill} disabled={requestingBill}
              style={{ padding: '13px 16px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', color: 'var(--ink)', opacity: requestingBill ? 0.6 : 1 }}>
              {requestingBill ? 'Enviando...' : 'Pedir cuenta'}
            </button>
          )}
          {activeItems.length > 0 && (
            <button onClick={() => navigate(`/pos/cobro?cuenta=${accountId}`)}
              style={{ padding: '13px 16px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>${account.total.toLocaleString('es-CL')}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>Cobrar</span>
            </button>
          )}
        </div>
      )}

      {/* Product picker sheet */}
      {showAddItem && (
        <ProductPickerSheet
          accountId={accountId}
          restaurantId={restaurantId}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {/* Settings drawer */}
      {showSettings && (
        <>
          <div className="pos-drawer-overlay" onClick={() => setShowSettings(false)} />
          <div className="pos-sheet" style={{ maxHeight: 'auto' }}>
            <div className="pos-sheet-header">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{accountName}</div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 8, color: 'var(--ink-3)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ padding: '8px 10px' }}>
              <button
                onClick={() => { setShowSettings(false); setCoversInput(String(account.covers ?? '')); setSettingsModal('comensales') }}
                className="pos-drawer-item"
              >
                <span className="pos-drawer-ic">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                Editar comensales
                {account.covers && <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{account.covers}</span>}
              </button>
              <button
                onClick={() => { setShowSettings(false); setSettingsModal('garzon') }}
                className="pos-drawer-item"
              >
                <span className="pos-drawer-ic">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                Cambiar garzón
                {account.opened_by_name && <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{account.opened_by_name}</span>}
              </button>
              <button
                className="pos-drawer-item"
                style={{ color: 'var(--ink-3)', cursor: 'not-allowed' }}
              >
                <span className="pos-drawer-ic">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </span>
                Separar cuenta
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)', background: 'var(--sunk)', padding: '2px 7px', borderRadius: 99 }}>Próximamente</span>
              </button>
              <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
              <button
                onClick={handleVoidAccount}
                className="pos-drawer-item"
                style={{ color: '#e05252' }}
              >
                <span className="pos-drawer-ic" style={{ background: '#fef2f2', color: '#e05252' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </span>
                Anular mesa
              </button>
            </div>
          </div>
        </>
      )}

      {/* Comensales modal */}
      {settingsModal === 'comensales' && (
        <div className="pos-modal-overlay">
          <div className="pos-modal">
            <div className="pos-modal-title">Editar comensales</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <button
                  key={n}
                  onClick={() => setCoversInput(String(n))}
                  style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${coversInput === String(n) ? 'var(--amber)' : 'var(--line)'}`, background: coversInput === String(n) ? 'var(--amber-tint-2)' : 'var(--sunk)', color: coversInput === String(n) ? 'var(--amber-press)' : 'var(--ink)', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--mono)' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="pos-modal-label">Otro número</label>
            <input
              className="pos-modal-input"
              type="number"
              min={1}
              placeholder="Ej: 12"
              value={coversInput}
              onChange={e => setCoversInput(e.target.value)}
            />
            <div className="pos-modal-actions">
              <button className="pos-modal-cancel" onClick={() => setSettingsModal(null)}>Cancelar</button>
              <button className="pos-modal-ok" onClick={handleSaveCovers} disabled={savingMeta}>
                {savingMeta ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Garzón modal */}
      {settingsModal === 'garzon' && (
        <div className="pos-modal-overlay">
          <div className="pos-modal">
            <div className="pos-modal-title">Cambiar garzón</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {garzones.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>Sin garzones configurados</p>
              ) : garzones.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleChangeGarzon(g.name)}
                  disabled={savingMeta}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, border: `1px solid ${account.opened_by_name === g.name ? 'var(--amber)' : 'var(--line)'}`, background: account.opened_by_name === g.name ? 'var(--amber-tint-2)' : 'var(--sunk)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
                >
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--amber-tint)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--amber-press)', flexShrink: 0 }}>
                    {g.name.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: account.opened_by_name === g.name ? 'var(--amber-press)' : 'var(--ink)' }}>{g.name}</span>
                  {account.opened_by_name === g.name && (
                    <span style={{ marginLeft: 'auto' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="pos-modal-actions">
              <button className="pos-modal-cancel" onClick={() => setSettingsModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Void item modal */}
      {voidModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(27,26,23,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Anular ítem</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>{voidModal.name}</div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Motivo</label>
            <input autoFocus value={voidReason} onChange={e => setVoidReason(e.target.value)}
              placeholder="Ej: Error de pedido, cliente cambió de opinión..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none', marginBottom: 16 }}
              onKeyDown={e => e.key === 'Enter' && handleVoidItem()} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setVoidModal(null)} style={{ flex: 1, padding: 13, borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Cancelar</button>
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

export default function CuentaPage() {
  return (
    <Suspense>
      <CuentaPageInner />
    </Suspense>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'menos de 1 min'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

function InfoChip({ icon, children, accent }: { icon: React.ReactNode; children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
      color: accent ? 'var(--slate)' : 'var(--ink-2)',
      background: accent ? 'var(--slate-tint)' : 'var(--sunk)',
      border: `1px solid ${accent ? 'var(--slate)' : 'var(--line)'}`,
      borderRadius: 99, padding: '5px 10px',
    }}>
      <span style={{ color: accent ? 'var(--slate)' : 'var(--ink-3)', display: 'flex' }}>{icon}</span>
      {children}
    </span>
  )
}
