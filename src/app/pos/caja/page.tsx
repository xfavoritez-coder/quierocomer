'use client'

import { useState } from 'react'
import { usePosNav } from '../lib/usePosNav'
import { usePosRestaurant } from '../lib/usePosRestaurant'
import {
  usePosSync,
  useOpenCashSession,
  useOpenAccounts,
  useSessionSummary,
  setRestaurantId,
  setUserId,
  openCashSession,
  closeCashSession,
} from '@/lib/pos'
import { v4 as uuidv4 } from 'uuid'
import PosHeader from '../components/PosHeader'
import type { PaymentMethod } from '@/lib/pos'

const TEST_USER_ID = 'pos-garzon'

const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  app_pago: 'App de pago',
}

const ALL_METHODS: PaymentMethod[] = ['efectivo', 'debito', 'credito', 'transferencia', 'app_pago']

export default function CajaPage() {
  const navigate = usePosNav()
  const { restaurantId } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const cashSession = useOpenCashSession()
  const openAccounts = useOpenAccounts()
  const summary = useSessionSummary(cashSession)

  const [initialAmount, setInitialAmount] = useState('50000')
  const [countedCash, setCountedCash] = useState('')
  const [closingNote, setClosingNote] = useState('')
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
  })

  const goHome = () => navigate('/pos')

  // ── OPEN SESSION ─────────────────────────────────────────────

  const handleOpen = async () => {
    const amount = parseInt(initialAmount.replace(/\D/g, ''), 10)
    if (!amount || amount < 0) { return }
    setOpening(true)
    try {
      await openCashSession({ session_id: uuidv4(), initial_amount: amount })
    } catch (err) {
    } finally {
      setOpening(false)
    }
  }

  // ── CLOSE SESSION ────────────────────────────────────────────

  const cashSales = summary.byMethod['efectivo']?.amount ?? 0
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
        const counted_amounts = ALL_METHODS.reduce((acc, m) => {
          acc[m] = m === 'efectivo' ? (hasCounted ? counted : expectedCash) : (summary.byMethod[m]?.amount ?? 0)
          return acc
        }, {} as Record<PaymentMethod, number>)

        const expected_amounts = ALL_METHODS.reduce((acc, m) => {
          acc[m] = summary.byMethod[m]?.amount ?? 0
          if (m === 'efectivo') acc[m] = expectedCash
          return acc
        }, {} as Record<PaymentMethod, number>)

        await closeCashSession({
          session_id: cashSession.id,
          counted_amounts,
          expected_amounts,
          difference: hasCounted ? difference : 0,
          note: closingNote || undefined,
        })
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

  const diffColor = !hasCounted
    ? 'var(--ink-3)'
    : difference === 0 ? 'var(--jade)'
    : difference < 0 ? '#C53030'
    : 'var(--amber-press)'

  // ── NO SESSION: apertura ─────────────────────────────────────

  if (!cashSession) {
    return (
      <div className="pos-shell">
        <PosHeader mode="back" eyebrow="Caja" subtitle="Sin sesión activa" syncing={syncing} onBack={goHome} />
        <div className="pos-scroll">
          <div className="pos-caja-wrap">
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
      </div>
    )
  }

  // ── SESSION OPEN: resumen + cierre ───────────────────────────

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Caja"
        subtitle={`Turno desde las ${openedAt}`}
        syncing={syncing}
        onBack={goHome}
      />

      <div className="pos-scroll">
        <div className="pos-caja-wrap">

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
                <div className="co-s">Hoy · {openedAt}</div>
              </div>
            </div>
            <div className="co-v">${openingAmount.toLocaleString('es-CL')}</div>
          </div>

          {/* ── Resumen por medio ───────────────────── */}
          <div className="pos-eyebrow" style={{ marginBottom: 10 }}>
            Ventas del turno <b>· {summary.closedAccounts} cuentas</b>
          </div>

          <div className="pos-mgrid">
            {ALL_METHODS.map(m => {
              const data = summary.byMethod[m]
              return (
                <div key={m} className="pos-mcard">
                  <div className="ml">{METHOD_LABELS[m]}</div>
                  <div className="mv">${(data?.amount ?? 0).toLocaleString('es-CL')}</div>
                  <div className="mc">{data?.count ?? 0} cobros</div>
                </div>
              )
            })}
            <div className="pos-mcard" style={{ gridColumn: 'span 2' }}>
              <div className="ml">Propinas</div>
              <div className="mv">${summary.totalTips.toLocaleString('es-CL')}</div>
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
            <div className="co-v">${summary.totalSales.toLocaleString('es-CL')}</div>
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
              onClick={() => {}}
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
    </div>
  )
}
