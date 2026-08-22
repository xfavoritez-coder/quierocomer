'use client'

import { useState, useCallback, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccount, usePosSync, setRestaurantId, setUserId, recordPayment, closeAccount } from '@/lib/pos'
import { v4 as uuidv4 } from 'uuid'
import PosHeader from '../components/PosHeader'
import { usePosNav } from '../lib/usePosNav'
import { usePosRestaurant } from '../lib/usePosRestaurant'

const TEST_USER_ID = 'pos-garzon'

type SplitMode = 'all' | 'items' | 'parts'
type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'app_pago'

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg> },
  { id: 'debito', label: 'Débito', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg> },
  { id: 'credito', label: 'Crédito', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg> },
  { id: 'transferencia', label: 'Transfer.', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h16M14 6l6 6-6 6"/></svg> },
  { id: 'app_pago', label: 'App de pago', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg> },
]

// ── Calculadora de vuelto ─────────────────────────────────────────

function VueltoCalc({ totalToPay }: { totalToPay: number }) {
  const [recibido, setRecibido] = useState('')
  const num = parseInt(recibido.replace(/\D/g, ''), 10) || 0
  const vuelto = Math.max(0, num - totalToPay)

  const BILLETES = [1000, 2000, 5000, 10000, 20000, 50000]

  const append = (v: number) => {
    setRecibido(prev => {
      const digits = (prev.replace(/\D/g, '') + String(v)).replace(/^0+/, '') || '0'
      return parseInt(digits, 10).toLocaleString('es-CL')
    })
  }

  useEffect(() => { setRecibido('') }, [totalToPay])

  return (
    <div style={{ marginTop: 16, padding: '16px', background: 'var(--sunk)', borderRadius: 14, border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>Recibido</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14 }}>${recibido || '0'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--line)', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>Vuelto</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: vuelto > 0 ? 'var(--jade)' : 'var(--ink)' }}>
          ${vuelto.toLocaleString('es-CL')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {BILLETES.map(b => (
          <button
            key={b}
            onClick={() => append(b)}
            style={{ flex: '1 1 auto', minWidth: 52, padding: '9px 4px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
          >
            ${(b / 1000).toLocaleString('es-CL')}k
          </button>
        ))}
        <button
          onClick={() => setRecibido('')}
          style={{ flex: '0 0 auto', padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }}
        >
          C
        </button>
      </div>
    </div>
  )
}

// ── Inner page ────────────────────────────────────────────────────

function CobroPageInner() {
  const navigate = usePosNav()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('cuenta')
  const { restaurantId } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const account = useAccount(accountId)

  const [splitMode, setSplitMode] = useState<SplitMode>('all')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('efectivo')
  const [paidItemIds, setPaidItemIds] = useState<Set<string>>(new Set())
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [partsCount, setPartsCount] = useState(2)
  const [currentPart, setCurrentPart] = useState(1)
  const [tipPercent, setTipPercent] = useState<number | null>(10)
  const [processing, setProcessing] = useState(false)

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
  })

  const items = account?.items.filter(i => !i.voided) ?? []
  const accountTotal = items.reduce((s, i) => {
    const modExtra = i.modifiers?.reduce((m, mod) => m + mod.price_adjustment, 0) ?? 0
    return s + i.quantity * (i.unit_price + modExtra)
  }, 0)

  // Subtotal según modo
  let subtotal = 0
  if (splitMode === 'all') {
    subtotal = accountTotal - items.filter(i => paidItemIds.has(i.id)).reduce((s, i) => s + i.quantity * i.unit_price, 0)
  } else if (splitMode === 'items') {
    subtotal = items.filter(i => selectedItemIds.has(i.id)).reduce((s, i) => s + i.quantity * i.unit_price, 0)
  } else {
    const perPart = Math.round(accountTotal / partsCount / 10) * 10
    const isLast = currentPart === partsCount
    subtotal = isLast ? accountTotal - perPart * (partsCount - 1) : perPart
  }

  const tipAmount = tipPercent ? Math.round(subtotal * tipPercent / 100 / 10) * 10 : 0
  const totalToPay = subtotal + tipAmount

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const goHome = () => navigate('/pos')

  const handlePay = useCallback(async () => {
    if (!accountId || totalToPay <= 0) return
    setProcessing(true)
    try {
      await recordPayment({
        payment_id: uuidv4(),
        account_id: accountId,
        method: selectedMethod,
        amount: subtotal,
        tip: tipAmount,
        ...(splitMode === 'items' && selectedItemIds.size > 0 ? { item_ids: Array.from(selectedItemIds) } : {}),
        ...(splitMode === 'parts' ? { split_index: currentPart } : {}),
      })

      if (splitMode === 'items') {
        const newPaid = new Set(paidItemIds)
        selectedItemIds.forEach(id => newPaid.add(id))
        const unpaid = items.filter(i => !newPaid.has(i.id))
        if (unpaid.length === 0) {
          await closeAccount({ account_id: accountId })
          goHome()
          return
        }
        setPaidItemIds(newPaid)
        setSelectedItemIds(new Set())
      } else if (splitMode === 'parts') {
        if (currentPart >= partsCount) {
          await closeAccount({ account_id: accountId })
          goHome()
          return
        }
        setCurrentPart(c => c + 1)
      } else {
        await closeAccount({ account_id: accountId })
        goHome()
        return
      }
    } catch (err) {
    } finally {
      setProcessing(false)
    }
  }, [accountId, totalToPay, selectedMethod, splitMode, selectedItemIds, paidItemIds, items, currentPart, partsCount, subtotal, tipAmount])

  if (!accountId) {
    return (
      <div className="pos-shell">
        <PosHeader mode="back" eyebrow="Cobro" subtitle="Sin cuenta" onBack={goHome} syncing={syncing} />
        <div className="pos-empty"><p>No se especificó una cuenta</p></div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="pos-shell">
        <PosHeader mode="back" eyebrow="Cobro" subtitle="Cargando..." onBack={goHome} syncing={syncing} />
        <div className="pos-empty" style={{ flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  const accountName = account.type === 'mesa'
    ? account.table_label || `Mesa ${account.table_number}`
    : account.type === 'delivery'
      ? `Delivery${account.customer_name ? ` · ${account.customer_name}` : ''}`
      : `Para llevar${account.customer_name ? ` · ${account.customer_name}` : ''}`

  const unpaidItems = items.filter(i => !paidItemIds.has(i.id))
  const allItemsPaid = splitMode === 'items' && unpaidItems.length === 0

  const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }
  const eyebrow: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--ink-3)', marginBottom: 10 }

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow={accountName}
        subtitle="Cobro"
        syncing={syncing}
        onBack={goHome}
      />

      <div className="pos-scroll">
        <div style={{ padding: '20px 16px 120px', maxWidth: 560, margin: '0 auto' }}>

          {/* ── Modo de división ──────────────────────────── */}
          <div className="pos-seg" style={{ marginBottom: 20 }}>
            {(['all', 'items', 'parts'] as const).map(mode => (
              <button
                key={mode}
                className={splitMode === mode ? 'on' : undefined}
                onClick={() => { setSplitMode(mode); setSelectedItemIds(new Set()); setCurrentPart(1) }}
              >
                {mode === 'all' ? 'Pagar todo' : mode === 'items' ? 'Por ítems' : 'Dividir'}
              </button>
            ))}
          </div>

          {/* ── Dividir en partes ─────────────────────────── */}
          {splitMode === 'parts' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sunk)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, color: 'var(--ink-2)', flex: 1 }}>
                {currentPart < partsCount ? `Pago ${currentPart} de ${partsCount}` : `Último pago (${partsCount} de ${partsCount})`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setPartsCount(p => Math.max(2, p - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink)' }}>−</button>
                <span style={{ ...mono, fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{partsCount}</span>
                <button onClick={() => setPartsCount(p => p + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink)' }}>+</button>
              </div>
            </div>
          )}

          {/* ── Ítems ─────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <div style={eyebrow}>{splitMode === 'items' ? 'Selecciona los ítems a cobrar' : 'Detalle'}</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--sh-1)' }}>
              {items.map((item, idx) => {
                const isPaid = paidItemIds.has(item.id)
                const isSelected = selectedItemIds.has(item.id)
                const isSelectable = splitMode === 'items' && !isPaid
                return (
                  <div
                    key={item.id}
                    onClick={() => isSelectable && toggleItem(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '13px 16px',
                      borderBottom: idx < items.length - 1 ? '1px solid var(--line)' : undefined,
                      opacity: isPaid ? 0.35 : 1,
                      background: isSelected ? 'var(--amber-tint)' : 'transparent',
                      cursor: isSelectable ? 'pointer' : 'default',
                      transition: '.12s',
                    }}
                  >
                    {splitMode === 'items' && !isPaid && (
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? 'var(--amber)' : 'var(--line)'}`, background: isSelected ? 'var(--amber)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, transition: '.12s' }}>
                        {isSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                      </div>
                    )}
                    <span style={{ ...mono, fontWeight: 600, fontSize: 13, color: 'var(--amber-press)', minWidth: 22 }}>{item.quantity}×</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: isPaid ? 'var(--ink-3)' : 'var(--ink)', textDecoration: isPaid ? 'line-through' : undefined }}>{item.dish_name}</div>
                      {item.modifiers?.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{item.modifiers.map(m => m.option_name).join(' · ')}</div>
                      )}
                    </div>
                    <span style={{ ...mono, fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }}>${(item.quantity * item.unit_price).toLocaleString('es-CL')}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Resumen ───────────────────────────────────── */}
          {!allItemsPaid && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: 'var(--sh-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                  Subtotal{splitMode === 'items' && selectedItemIds.size > 0 ? ` (${selectedItemIds.size} ítem${selectedItemIds.size !== 1 ? 's' : ''})` : ''}
                </span>
                <span style={{ ...mono, fontSize: 14, color: 'var(--ink-2)' }}>${subtotal.toLocaleString('es-CL')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 14, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Propina
                  <button
                    onClick={() => setTipPercent(tipPercent === 10 ? null : 10)}
                    style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, border: '1px solid var(--line)', background: tipPercent ? 'var(--amber-tint)' : 'var(--sunk)', color: tipPercent ? 'var(--amber-press)' : 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--sans)' }}
                  >
                    {tipPercent ? `10% · quitar` : '+ Agregar'}
                  </button>
                </span>
                <span style={{ ...mono, fontSize: 14, color: 'var(--ink-2)' }}>${tipAmount.toLocaleString('es-CL')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Total a cobrar</span>
                <span style={{ ...mono, fontWeight: 700, fontSize: 18 }}>${totalToPay.toLocaleString('es-CL')}</span>
              </div>
            </div>
          )}

          {/* ── Todo pagado ───────────────────────────────── */}
          {allItemsPaid && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--jade)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginBottom: 10 }}><path d="M20 6L9 17l-5-5"/></svg>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Todo pagado</div>
            </div>
          )}

          {/* ── Método de pago ────────────────────────────── */}
          {!allItemsPaid && (
            <>
              <div style={eyebrow}>Método de pago</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 0 }}>
                {METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '12px 8px', borderRadius: 12,
                      border: `2px solid ${selectedMethod === m.id ? 'var(--amber)' : 'var(--line)'}`,
                      background: selectedMethod === m.id ? 'var(--amber-tint)' : 'var(--surface)',
                      color: selectedMethod === m.id ? 'var(--amber-press)' : 'var(--ink-2)',
                      cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12,
                      transition: '.12s',
                    }}
                  >
                    <span style={{ width: 22, height: 22 }}>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* ── Vuelto ──────────────────────────────────── */}
              {selectedMethod === 'efectivo' && totalToPay > 0 && (
                <VueltoCalc totalToPay={totalToPay} />
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Sticky bottom bar ─────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px' }}>
        {allItemsPaid ? (
          <button
            onClick={goHome}
            style={{ width: '100%', padding: '14px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--sans)', boxShadow: '0 2px 4px rgba(222,124,0,.2),0 6px 16px rgba(222,124,0,.22)' }}
          >
            Ir al inicio
          </button>
        ) : (
          <button
            onClick={handlePay}
            disabled={processing || totalToPay <= 0 || (splitMode === 'items' && selectedItemIds.size === 0)}
            style={{ width: '100%', padding: '14px', borderRadius: 'var(--r-btn)', border: 0, background: 'var(--amber)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'var(--sans)', boxShadow: '0 2px 4px rgba(222,124,0,.2),0 6px 16px rgba(222,124,0,.22)', opacity: (processing || totalToPay <= 0 || (splitMode === 'items' && selectedItemIds.size === 0)) ? 0.5 : 1, transition: '.14s' }}
          >
            {processing ? 'Registrando...' : `Registrar pago · $${totalToPay.toLocaleString('es-CL')}`}
          </button>
        )}
      </div>
    </div>
  )
}

export default function CobroPage() {
  return (
    <Suspense>
      <CobroPageInner />
    </Suspense>
  )
}
