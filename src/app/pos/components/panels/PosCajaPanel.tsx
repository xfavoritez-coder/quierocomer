'use client'

import { useEffect, useState } from 'react'
import {
  usePosSync,
  useOpenCashSession,
  useOpenAccounts,
  useSessionSummary,
  setRestaurantId,
  setUserId,
  openCashSession,
  closeCashSession,
  toPaymentMethod,
  deliveryPlatformLabel,
} from '@/lib/pos'
import { v4 as uuidv4 } from 'uuid'
import type { PaymentMethod } from '@/lib/pos'
import { printCashClose, getBridgeUrl } from '@/lib/pos/bridge'
import { toast } from 'sonner'
import { usePosRestaurant } from '../../lib/usePosRestaurant'
import PosCajaHistorial from '../PosCajaHistorial'
import StaleAccountsCleanup from '../StaleAccountsCleanup'

const TEST_USER_ID = 'pos-garzon'

const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  app_pago: 'App de pago',
  webpay: 'Webpay',
}

const ALL_METHODS: PaymentMethod[] = ['efectivo', 'debito', 'credito', 'transferencia', 'app_pago', 'webpay']

export default function PosCajaPanel({ restaurantId, title, onDone }: { restaurantId: string; title?: string; onDone?: () => void }) {
  const { restaurant, loading: restLoading } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const cashSession = useOpenCashSession(restaurantId)
  const openAccounts = useOpenAccounts(restaurantId)
  const summary = useSessionSummary(cashSession ?? undefined, restaurantId)

  const [initialAmount, setInitialAmount] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [closingNote, setClosingNote] = useState('')
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)

  useEffect(() => {
    if (restaurantId) setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
  }, [restaurantId])

  const [webSales, setWebSales] = useState<{ byMethod: Record<string, { amount: number; tip: number; count: number }>; total: number; tips: number; count: number }>({ byMethod: {}, total: 0, tips: 0, count: 0 })
  useEffect(() => {
    if (!restaurantId || !cashSession) { setWebSales({ byMethod: {}, total: 0, tips: 0, count: 0 }); return }
    let cancelled = false
    const load = async () => {
      try {
        const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
        // El turno abarca TODO el día de apertura: cuenta los pedidos del día aunque
        // se hayan pagado ANTES de abrir la caja (un pedido pertenece a su día, no a
        // la hora en que se abrió la caja). Límite inferior = medianoche del día de
        // apertura (hora local = Chile), no el instante exacto de apertura.
        const openedDate = new Date(cashSession.opened_at)
        const openedMs = new Date(openedDate.getFullYear(), openedDate.getMonth(), openedDate.getDate(), 0, 0, 0, 0).getTime()
        const res = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=pagados&from=${fmt(openedDate)}&to=${fmt(new Date())}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const byMethod: Record<string, { amount: number; tip: number; count: number }> = {}
        let total = 0, tips = 0, count = 0
        for (const o of (data.orders ?? [])) {
          if (new Date(o.createdAt).getTime() < openedMs) continue
          const amount = Number(o.totalAmount) || 0
          if (amount <= 0 || (Number(o.paidAmount) || 0) < amount) continue
          const rp = (o.rawPayload && typeof o.rawPayload === 'object' && !Array.isArray(o.rawPayload)) ? o.rawPayload as Record<string, unknown> : {}
          const pp = rp.posPayment as { method?: string; parts?: { method?: string; amount?: number }[] } | undefined
          const wp = rp.webPayment as { method?: string } | undefined
          const platform = deliveryPlatformLabel(o.vendorName)
          const tip = Number(o.tipAmount) || 0
          const addTo = (m: string, amt: number, tp: number) => {
            if (!byMethod[m]) byMethod[m] = { amount: 0, tip: 0, count: 0 }
            byMethod[m].amount += amt; byMethod[m].tip += tp
          }
          // Pago combinado: reparte cada parte en su método; la propina va al primero.
          const parts = Array.isArray(pp?.parts) ? pp!.parts!.filter(p => (Number(p.amount) || 0) > 0) : []
          if (!platform && parts.length > 1) {
            parts.forEach((p, i) => addTo(toPaymentMethod(p.method), Number(p.amount) || 0, i === 0 ? tip : 0))
            byMethod[toPaymentMethod(parts[0].method)].count++
          } else {
            const method = platform ?? toPaymentMethod(parts[0]?.method || pp?.method || wp?.method)
            addTo(method, amount, tip)
            byMethod[method].count++
          }
          total += amount; tips += tip; count++
        }
        if (!cancelled) setWebSales({ byMethod, total, tips, count })
      } catch { /* noop */ }
    }
    load()
    const id = setInterval(load, 20000)
    return () => { cancelled = true; clearInterval(id) }
  }, [restaurantId, cashSession?.id])

  const byMethod: Record<string, { amount: number; tip: number; count: number }> = {}
  const allKeys = new Set<string>([...ALL_METHODS, ...Object.keys(summary.byMethod), ...Object.keys(webSales.byMethod)])
  for (const m of allKeys) {
    const a = summary.byMethod[m]; const b = webSales.byMethod[m]
    if (a || b) byMethod[m] = { amount: (a?.amount ?? 0) + (b?.amount ?? 0), tip: (a?.tip ?? 0) + (b?.tip ?? 0), count: (a?.count ?? 0) + (b?.count ?? 0) }
  }
  const extraMethods = Object.keys(byMethod).filter(m => !(ALL_METHODS as string[]).includes(m))
  const totalSales = summary.totalSales + webSales.total
  const totalTips = summary.totalTips + webSales.tips
  const closedAccounts = summary.closedAccounts + webSales.count

  const goHome = () => onDone?.()

  // Botón de acceso al historial de cierres (va arriba, en ambos estados de caja).
  const historialBtn = (
    <button
      onClick={() => setShowHistorial(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
      </svg>
      Historial
    </button>
  )

  const handleOpen = async () => {
    const parsed = parseInt(initialAmount.replace(/\D/g, ''), 10)
    const amount = Number.isFinite(parsed) ? parsed : 0
    setOpening(true)
    try {
      await openCashSession({ session_id: uuidv4(), initial_amount: amount })
    } catch (err) {
    } finally {
      setOpening(false)
    }
  }

  const cashSales = byMethod['efectivo']?.amount ?? 0
  const openingAmount = cashSession?.initial_amount ?? 0
  const expectedCash = openingAmount + cashSales
  const counted = parseInt(countedCash.replace(/\D/g, ''), 10) || 0
  const difference = countedCash ? counted - expectedCash : 0
  const hasCounted = countedCash.length > 0

  const handleClose = async () => {
    if (openAccounts.length > 0 && !confirmOpen) {
      setConfirmOpen(true)
      return
    }
    setClosing(true)
    try {
      if (cashSession) {
        const counted_amounts = [...ALL_METHODS, ...extraMethods].reduce((acc, m) => {
          acc[m] = m === 'efectivo' ? (hasCounted ? counted : expectedCash) : (byMethod[m]?.amount ?? 0)
          return acc
        }, {} as Record<string, number>)

        const expected_amounts = [...ALL_METHODS, ...extraMethods].reduce((acc, m) => {
          acc[m] = byMethod[m]?.amount ?? 0
          if (m === 'efectivo') acc[m] = expectedCash
          return acc
        }, {} as Record<string, number>)

        const closePayload = buildClosePayload()

        await closeCashSession({
          session_id: cashSession.id,
          counted_amounts,
          expected_amounts,
          difference: hasCounted ? difference : 0,
          note: closingNote || undefined,
          total_sales: totalSales,
          total_tips: totalTips,
          closed_accounts: closedAccounts,
        })

        if (getBridgeUrl()) {
          const pr = await printCashClose(closePayload)
          if (!pr.ok) {
            // El cierre YA se guardó arriba; esto es solo la impresión del ticket.
            // "Failed to fetch" = el agente de impresión (localhost:7777) no está
            // disponible. Se avisa claro para no alarmar: el cierre está hecho.
            const isConn = /failed to fetch|load failed|networkerror|conexión|aborted|timeout|abort/i.test(pr.error || '')
            toast.error(
              isConn
                ? 'El cierre se guardó. No se pudo imprimir el ticket: el agente de impresión no está disponible.'
                : `El cierre se guardó, pero no se pudo imprimir el ticket: ${pr.error}`,
            )
          }
        }
      }
      goHome()
    } catch (err) {
    } finally {
      setClosing(false)
      setConfirmOpen(false)
    }
  }

  const openedAt = cashSession?.opened_at
    ? new Date(cashSession.opened_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const openedDayLabel = cashSession?.opened_at
    ? (new Date(cashSession.opened_at).toDateString() === new Date().toDateString()
        ? 'Hoy'
        : new Date(cashSession.opened_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }))
    : 'Hoy'

  const diffColor = !hasCounted
    ? 'var(--ink-3)'
    : difference === 0 ? 'var(--jade)'
    : difference < 0 ? '#C53030'
    : 'var(--amber-press)'

  const buildClosePayload = () => {
    const now = new Date()
    return {
      jobId: 'cierre_' + uuidv4(),
      restaurantName: restaurant?.name,
      date: now.toLocaleDateString('es-CL'),
      openedAt,
      closedAt: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      closedAccounts,
      methods: [...ALL_METHODS, ...extraMethods].map(m => ({ label: METHOD_LABELS[m] ?? m, amount: byMethod[m]?.amount ?? 0, count: byMethod[m]?.count ?? 0 })),
      totalTips,
      totalSales,
      opening: openingAmount,
      cashSales,
      expectedCash,
      countedCash: hasCounted ? counted : null,
      difference: hasCounted ? difference : null,
      note: closingNote || undefined,
    }
  }

  const handlePrint = async () => {
    if (!getBridgeUrl()) { toast.error('No hay agente de impresión configurado'); return }
    const r = await printCashClose(buildClosePayload())
    if (r.ok) toast.success('Cierre enviado a la impresora')
    else toast.error(r.error || 'No se pudo imprimir')
  }

  // ── Vista de historial de cierres ───────────────────────────
  if (showHistorial) {
    return (
      <div className="pos-scroll">
        <div className="pos-caja-wrap">
          <button
            onClick={() => setShowHistorial(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 6px', marginBottom: 14, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
            Volver a la caja
          </button>
          <p className="pos-inner-title" style={{ marginBottom: 14 }}>Historial de cierres</p>
          <PosCajaHistorial restaurantId={restaurantId} />
        </div>
      </div>
    )
  }

  if (restLoading && !cashSession) {
    return (
      <div className="pos-scroll">
        <div className="pos-caja-wrap">
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!cashSession) {
    return (
      <div className="pos-scroll">
        <div className="pos-caja-wrap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            {title ? <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p> : <span />}
            {historialBtn}
          </div>
          <div className="pos-empty" style={{ minHeight: 120, marginBottom: 28 }}>
            <div className="ring">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/>
              </svg>
            </div>
            <p>No hay caja abierta</p>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '20px 18px', boxShadow: 'var(--sh-1)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Abrir caja</div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Monto inicial en efectivo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 16 }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={initialAmount}
                placeholder="50.000"
                onChange={e => setInitialAmount(e.target.value.replace(/\D/g, ''))}
                style={{
                  flex: 1, fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700,
                  textAlign: 'right', padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid var(--line)', background: 'var(--sunk)',
                  color: 'var(--ink)', outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleOpen}
              disabled={opening}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--r-btn)',
                border: 0, background: 'var(--amber)', color: '#fff',
                fontWeight: 700, fontSize: 15, cursor: opening ? 'default' : 'pointer',
                opacity: opening ? 0.7 : 1,
              }}
            >
              {opening ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pos-scroll">
      <div className="pos-caja-wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          {title ? <p className="pos-inner-title" style={{ margin: 0 }}>{title}</p> : <span />}
          {historialBtn}
        </div>
        {/* ── Apertura ───────────────────────────── */}
        <div className="pos-caja-open">
          <div className="co-l">
            <div className="co-ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/>
              </svg>
            </div>
            <div>
              <div className="co-t">Apertura de caja</div>
              <div className="co-s">{openedDayLabel} · {openedAt}</div>
            </div>
          </div>
          <div className="co-v">${openingAmount.toLocaleString('es-CL')}</div>
        </div>

        {/* ── Resumen por medio ───────────────────── */}
        <div className="pos-eyebrow" style={{ marginBottom: 10 }}>
          Ventas del turno <b>· {closedAccounts} cuentas</b>
        </div>

        <div className="pos-mgrid">
          {[...ALL_METHODS, ...extraMethods].map(m => {
            const data = byMethod[m]
            return (
              <div key={m} className="pos-mcard">
                <div className="ml">{METHOD_LABELS[m] ?? m}</div>
                <div className="mv">${(data?.amount ?? 0).toLocaleString('es-CL')}</div>
                <div className="mc">{data?.count ?? 0} cobros</div>
              </div>
            )
          })}
          <div className="pos-mcard" style={{ gridColumn: 'span 2' }}>
            <div className="ml">Propinas</div>
            <div className="mv">${totalTips.toLocaleString('es-CL')}</div>
            <div className="mc">Turno completo</div>
          </div>
        </div>

        {/* ── Total ────────────────────────────────── */}
        <div className="pos-caja-open" style={{ marginTop: 4 }}>
          <div className="co-l">
            <div>
              <div className="co-t">Total ventas</div>
              <div className="co-s">Sin propinas</div>
            </div>
          </div>
          <div className="co-v">${totalSales.toLocaleString('es-CL')}</div>
        </div>

        {/* ── Arqueo ───────────────────────────────── */}
        <div className="pos-arqueo">
          <h4>Arqueo de efectivo</h4>

          {[
            { label: 'Apertura', value: openingAmount },
            { label: 'Ventas en efectivo', value: cashSales },
            { label: 'Efectivo esperado', value: expectedCash },
          ].map(row => (
            <div key={row.label} className="pos-aqr">
              <span>{row.label}</span>
              <span className="av">${row.value.toLocaleString('es-CL')}</span>
            </div>
          ))}

          <div className="pos-aqr">
            <span>Efectivo contado</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={countedCash}
                onChange={e => setCountedCash(e.target.value.replace(/\D/g, ''))}
                placeholder={expectedCash.toLocaleString('es-CL')}
                style={{
                  fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums',
                  color: 'var(--ink)', background: 'var(--sunk)', border: '1px solid var(--line)',
                  borderRadius: 8, padding: '6px 10px', outline: 'none',
                  width: '8rem', textAlign: 'right', fontSize: 15, fontWeight: 500,
                }}
              />
            </div>
          </div>

          <div className="pos-aqr diff">
            <span className="al">Diferencia</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasCounted && difference === 0 && (
                <span className="pos-ok-tag">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  Cuadrado
                </span>
              )}
              <span className="av" style={{ color: diffColor }}>
                {hasCounted
                  ? `$${Math.abs(difference).toLocaleString('es-CL')}${difference < 0 ? ' (faltante)' : difference > 0 ? ' (sobrante)' : ''}`
                  : '$–'}
              </span>
            </span>
          </div>

          {/* Nota opcional */}
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
              Nota de cierre (opcional)
            </label>
            <input
              type="text"
              value={closingNote}
              onChange={e => setClosingNote(e.target.value)}
              placeholder="Ej: faltaron billetes de $1.000, se pagó en otra caja..."
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--line)', background: 'var(--sunk)',
                fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'var(--sans)',
              }}
            />
          </div>
        </div>

        {/* ── Limpieza de cuentas vacías abandonadas ── */}
        <StaleAccountsCleanup restaurantId={restaurantId} />

        {/* ── Cuentas abiertas — alerta ────────────── */}
        {confirmOpen && openAccounts.length > 0 && (
          <div className="pos-caja-open" style={{ flexDirection: 'column', alignItems: 'stretch', fontSize: 13, background: 'var(--amber-tint-2)', borderColor: 'var(--amber)' }}>
            <p className="co-t" style={{ marginBottom: 8 }}>
              {openAccounts.length} cuenta{openAccounts.length > 1 ? 's' : ''} abierta{openAccounts.length > 1 ? 's' : ''}:
            </p>
            <ul style={{ paddingLeft: 18, color: 'var(--ink-2)' }}>
              {openAccounts.map(a => (
                <li key={a.id} style={{ marginBottom: 4 }}>
                  {a.type === 'mesa' ? `Mesa ${a.table_number}` : a.type === 'mostrador' ? 'Mostrador' : `Retiro: ${a.customer_name}`}
                  {' · '}${a.total.toLocaleString('es-CL')}
                </li>
              ))}
            </ul>
            <p className="co-t" style={{ marginTop: 8 }}>¿Cerrar caja de todas formas?</p>
          </div>
        )}

        {/* ── Botones ──────────────────────────────── */}
        <div className="pos-caja-btns">
          <button
            className="close"
            onClick={handleClose}
            disabled={closing}
            style={closing ? { background: 'var(--line-strong)', color: 'var(--ink-3)', boxShadow: 'none', cursor: 'default' } : undefined}
          >
            {closing ? 'Cerrando...' : confirmOpen ? 'Confirmar cierre' : 'Cerrar caja'}
          </button>
          <button
            className="print"
            onClick={handlePrint}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="6" y="3" width="12" height="6"/><rect x="6" y="14" width="12" height="7"/>
              <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>
            </svg>
            Imprimir
          </button>
        </div>

      </div>
    </div>
  )
}
