'use client'

import { useState, useCallback, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAccount, usePosSync, setRestaurantId, setUserId, recordPayment, closeAccount } from '@/lib/pos'
import { v4 as uuidv4 } from 'uuid'
import PosHeader from '../components/PosHeader'
import { usePosNav } from '../lib/usePosNav'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

type SplitMode = 'all' | 'items' | 'parts'
type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'app_pago'

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; wide?: boolean }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg> },
  { id: 'debito', label: 'Débito', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg> },
  { id: 'credito', label: 'Crédito', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg> },
  { id: 'transferencia', label: 'Transfer.', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h16M14 6l6 6-6 6"/></svg> },
  { id: 'app_pago', label: 'App de pago', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>, wide: true },
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
    <div className="pos-vuelto">
      <div className="pos-vuelto-row">
        <span className="vl">Recibido</span>
        <span className="vn">${recibido || '0'}</span>
      </div>
      <div className="pos-vuelto-row">
        <span className="vl">Vuelto</span>
        <span className={`vn ${vuelto > 0 ? 'green' : ''}`}>${vuelto.toLocaleString('es-CL')}</span>
      </div>
      <div className="pos-billetes">
        {BILLETES.map(b => (
          <button key={b} className="pos-billete" onClick={() => append(b)}>
            ${(b / 1000).toLocaleString('es-CL')}k
          </button>
        ))}
        <button className="pos-billete clear" onClick={() => setRecibido('')}>C</button>
      </div>
    </div>
  )
}

// ── Inner page ────────────────────────────────────────────────────

function CobroPageInner() {
  const navigate = usePosNav()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('cuenta')
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
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
    setRestaurantId(TEST_RESTAURANT_ID)
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
          // Todos los ítems pagados → cerrar cuenta
          await closeAccount({ account_id: accountId })
          toast.success('Cuenta cerrada')
          goHome()
          return
        }

        setPaidItemIds(newPaid)
        setSelectedItemIds(new Set())
        toast.success('Pago registrado')
      } else if (splitMode === 'parts') {
        if (currentPart >= partsCount) {
          await closeAccount({ account_id: accountId })
          toast.success('Cuenta cerrada')
          goHome()
          return
        }
        setCurrentPart(c => c + 1)
        toast.success(`Pago ${currentPart} de ${partsCount} registrado`)
      } else {
        await closeAccount({ account_id: accountId })
        toast.success('Cuenta cerrada')
        goHome()
        return
      }
    } catch (err) {
      toast.error('Error al registrar pago: ' + String(err))
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
    ? `Mesa ${account.table_number}`
    : account.type === 'mostrador' ? 'Mostrador'
    : `Retiro · ${account.customer_name}`

  const unpaidItems = items.filter(i => !paidItemIds.has(i.id))
  const allItemsPaid = splitMode === 'items' && unpaidItems.length === 0

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Cobro"
        subtitle={accountName}
        syncing={syncing}
        onBack={goHome}
      />

      <div className="pos-cobro">
        {/* ── Left: Bill ──────────────────────────── */}
        <div className="pos-cobro-main">
          {/* Segmented control */}
          <div className="pos-seg">
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

          {/* Parts input */}
          {splitMode === 'parts' && (
            <div className="pos-parts">
              <span className="pl">Dividir en</span>
              <div className="pg">
                <button className="pb" onClick={() => setPartsCount(p => Math.max(2, p - 1))}>−</button>
                <span className="pv">{partsCount}</span>
                <button className="pb" onClick={() => setPartsCount(p => p + 1)}>+</button>
              </div>
              <span className="pl">personas</span>
            </div>
          )}

          {/* Bill rows */}
          <div className="pos-bill">
            {items.map(item => {
              const isPaid = paidItemIds.has(item.id)
              const isSelected = selectedItemIds.has(item.id)
              const isSelectable = splitMode === 'items' && !isPaid

              const rowClasses = [
                'pos-bill-row',
                isPaid && 'paid',
                isSelectable && 'selectable',
                isSelected && 'selected',
              ].filter(Boolean).join(' ')

              return (
                <div key={item.id} className={rowClasses} onClick={() => isSelectable && toggleItem(item.id)}>
                  <div className="bl">
                    <span className="bq">{item.quantity}×</span>
                    <div>
                      <div className="bn">{item.dish_name}</div>
                      {item.modifiers?.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                          {item.modifiers.map(m => m.option_name).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="bp">${(item.quantity * item.unit_price).toLocaleString('es-CL')}</span>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 4px', borderTop: '2px solid var(--line-strong)', marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15 }}>${accountTotal.toLocaleString('es-CL')}</span>
          </div>
        </div>

        {/* ── Right: Payment panel ──────────────────── */}
        <div className="pos-cobro-side">
          {allItemsPaid ? (
            <div className="pos-empty" style={{ flex: 1 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--jade)" strokeWidth="1.8"><path d="M20 6L9 17l-5-5"/></svg>
              <p style={{ color: 'var(--jade)', fontWeight: 600 }}>Todo pagado</p>
            </div>
          ) : (
            <>
              <div className="pos-side-h">
                {splitMode === 'parts' ? `Pago ${currentPart} de ${partsCount}` : 'Pago'}
              </div>

              <div className="pos-srow">
                <span>Subtotal{splitMode === 'items' && selectedItemIds.size > 0 ? ` (${selectedItemIds.size} ítems)` : ''}</span>
                <span className="sv">${subtotal.toLocaleString('es-CL')}</span>
              </div>

              <div className="pos-srow">
                <span>
                  Propina{' '}
                  <button
                    className={`pos-tip${tipPercent ? '' : ' off'}`}
                    onClick={() => setTipPercent(tipPercent === 10 ? null : 10)}
                  >
                    {tipPercent ? `${tipPercent}% · quitar` : 'Agregar'}
                  </button>
                </span>
                <span className="sv">${tipAmount.toLocaleString('es-CL')}</span>
              </div>

              <div className="pos-saldo">
                <span className="sl">Saldo a cobrar</span>
                <span className="sn">${totalToPay.toLocaleString('es-CL')}</span>
              </div>

              <div className="pos-methods">
                {METHODS.map(m => (
                  <button
                    key={m.id}
                    className={`pos-m${selectedMethod === m.id ? ' on' : ''}${m.wide ? ' wide' : ''}`}
                    onClick={() => setSelectedMethod(m.id)}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {selectedMethod === 'efectivo' && totalToPay > 0 && (
                <VueltoCalc totalToPay={totalToPay} />
              )}

              <button
                className="pos-pay"
                onClick={handlePay}
                disabled={processing || totalToPay <= 0 || (splitMode === 'items' && selectedItemIds.size === 0)}
                style={{ marginTop: 'auto' }}
              >
                {processing ? 'Registrando...' : `Registrar · $${totalToPay.toLocaleString('es-CL')}`}
              </button>
            </>
          )}
        </div>
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
