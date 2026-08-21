'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAccount, usePosSync, setRestaurantId, setUserId, recordPayment, closeAccount } from '@/lib/pos'
import { v4 as uuidv4 } from 'uuid'
import PosHeader from '../components/PosHeader'

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

export default function CobroPage() {
  const router = useRouter()
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
  const accountTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  // Calculate subtotal based on split mode
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

  const tipAmount = tipPercent ? Math.round(subtotal * tipPercent / 100) : 0
  const totalToPay = subtotal + tipAmount

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

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
        setPaidItemIds(prev => {
          const next = new Set(prev)
          selectedItemIds.forEach(id => next.add(id))
          return next
        })
        setSelectedItemIds(new Set())
      } else if (splitMode === 'parts') {
        if (currentPart >= partsCount) {
          await closeAccount({ account_id: accountId })
          toast.success('Cuenta cerrada')
          router.push('/pos')
          return
        }
        setCurrentPart(c => c + 1)
      } else {
        await closeAccount({ account_id: accountId })
        toast.success('Cuenta cerrada')
        router.push('/pos')
        return
      }

      toast.success('Pago registrado')
    } catch (err) {
      toast.error('Error al registrar pago: ' + String(err))
    } finally {
      setProcessing(false)
    }
  }, [accountId, totalToPay, selectedMethod, splitMode, selectedItemIds, currentPart, partsCount, router])

  if (!accountId) {
    return (
      <div className="pos-shell">
        <PosHeader mode="back" eyebrow="Cobro" subtitle="Sin cuenta" onBack={() => router.push('/pos')} syncing={syncing} />
        <div className="pos-empty">
          <p>No se especificó una cuenta</p>
        </div>
      </div>
    )
  }

  const accountName = account
    ? account.type === 'mesa' ? `Mesa ${account.table_number}` : account.type === 'mostrador' ? 'Mostrador' : `Retiro · ${account.customer_name}`
    : 'Cargando...'

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Cobro"
        subtitle={accountName}
        syncing={syncing}
        onBack={() => router.push('/pos')}
      />

      <div className="pos-cobro">
        {/* ── Left: Bill ───────────────────────────── */}
        <div className="pos-cobro-main">
          {/* Segmented control */}
          <div className="pos-seg">
            {(['all', 'items', 'parts'] as const).map(mode => (
              <button
                key={mode}
                className={splitMode === mode ? 'on' : undefined}
                onClick={() => { setSplitMode(mode); setSelectedItemIds(new Set()); setCurrentPart(1) }}
              >
                {mode === 'all' ? 'Pagar todo' : mode === 'items' ? 'Dividir por ítems' : 'Dividir en partes'}
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
                <div
                  key={item.id}
                  className={rowClasses}
                  onClick={() => isSelectable && toggleItem(item.id)}
                >
                  <div className="bl">
                    <span className="bq">{item.quantity}×</span>
                    <span className="bn">{item.dish_name}</span>
                  </div>
                  <span className="bp">
                    ${(item.quantity * item.unit_price).toLocaleString('es-CL')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: Payment panel ─────────────────── */}
        <div className="pos-cobro-side">
          {/* Payment counter */}
          <div className="pos-side-h">
            {splitMode === 'parts' ? `Pago ${currentPart} de ${partsCount}` : 'Pago'}
          </div>

          {/* Subtotal */}
          <div className="pos-srow">
            <span>Subtotal{splitMode === 'items' && selectedItemIds.size > 0 ? ` (${selectedItemIds.size})` : ''}</span>
            <span className="sv">${subtotal.toLocaleString('es-CL')}</span>
          </div>

          {/* Tip */}
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

          {/* Saldo a cobrar */}
          <div className="pos-saldo">
            <span className="sl">Saldo a cobrar</span>
            <span className="sn">${totalToPay.toLocaleString('es-CL')}</span>
          </div>

          {/* Methods */}
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

          {/* Pay button */}
          <button
            className="pos-pay"
            onClick={handlePay}
            disabled={processing || totalToPay <= 0}
          >
            {processing ? 'Registrando...' : `Registrar pago · $${totalToPay.toLocaleString('es-CL')}`}
          </button>
        </div>
      </div>
    </div>
  )
}
