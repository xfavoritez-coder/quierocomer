'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  usePosSync,
  useOpenCashSession,
  useOpenAccounts,
  setRestaurantId,
  setUserId,
  closeCashSession,
} from '@/lib/pos'
import PosHeader from '../components/PosHeader'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

// Demo data — will come from real events once payment tracking is wired
const DEMO_METHODS = [
  { label: 'Efectivo', amount: 184300, count: 14 },
  { label: 'Débito', amount: 421900, count: 28 },
  { label: 'Crédito', amount: 312500, count: 19 },
  { label: 'Transferencia', amount: 96800, count: 6 },
  { label: 'App de pago', amount: 54200, count: 4 },
  { label: 'Propinas', amount: 71400, count: 0, isTip: true },
]

export default function CajaPage() {
  const router = useRouter()
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const cashSession = useOpenCashSession()
  const openAccounts = useOpenAccounts()

  const [countedCash, setCountedCash] = useState('')
  const [closing, setClosing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  const openingAmount = cashSession?.initial_amount ?? 50000
  const cashSales = DEMO_METHODS.find(m => m.label === 'Efectivo')?.amount ?? 0
  const expectedCash = openingAmount + cashSales
  const counted = countedCash ? parseInt(countedCash, 10) : 0
  const difference = counted - expectedCash
  const hasCounted = countedCash.length > 0

  const handleClose = async () => {
    if (openAccounts.length > 0 && !confirmOpen) {
      setConfirmOpen(true)
      return
    }

    setClosing(true)
    try {
      if (cashSession) {
        await closeCashSession({
          session_id: cashSession.id,
          counted_amounts: { efectivo: counted, debito: 0, credito: 0, transferencia: 0, app_pago: 0 },
          expected_amounts: { efectivo: expectedCash, debito: 0, credito: 0, transferencia: 0, app_pago: 0 },
          difference,
        })
      }
      toast.success('Caja cerrada')
      router.push('/pos')
    } catch (err) {
      toast.error('Error al cerrar caja: ' + String(err))
    } finally {
      setClosing(false)
      setConfirmOpen(false)
    }
  }

  const openedAt = cashSession?.opened_at
    ? new Date(cashSession.opened_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : '12:30'

  const diffColor = !hasCounted
    ? 'var(--ink-3)'
    : difference === 0
      ? 'var(--ink)'
      : difference < 0
        ? '#C53030'
        : 'var(--amber-press)'

  return (
    <div className="pos-shell">
      <PosHeader
        mode="back"
        eyebrow="Caja"
        subtitle="Cierre de turno · Hoy"
        syncing={syncing}
        onBack={() => router.push('/pos')}
      />

      <div className="pos-scroll">
        <div className="pos-caja-wrap">

          {/* ── Opening banner ──────────────────────── */}
          <div className="pos-caja-open">
            <div className="co-l">
              <div className="co-ic">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/>
                </svg>
              </div>
              <div>
                <div className="co-t">Apertura de caja</div>
                <div className="co-s">
                  Hoy · {openedAt} · Jaime C.
                </div>
              </div>
            </div>
            <div className="co-v">
              ${openingAmount.toLocaleString('es-CL')}
            </div>
          </div>

          {/* ── Methods grid ───────────────────────── */}
          <div className="pos-mgrid">
            {DEMO_METHODS.map(m => (
              <div key={m.label} className="pos-mcard">
                <div className="ml">{m.label}</div>
                <div className="mv">${m.amount.toLocaleString('es-CL')}</div>
                <div className="mc">
                  {m.isTip ? 'Total turno' : `${m.count} pagos`}
                </div>
              </div>
            ))}
          </div>

          {/* ── Cash count (arqueo) ─────────────────── */}
          <div className="pos-arqueo">
            <h4>Arqueo de efectivo</h4>

            {/* Rows */}
            {[
              { label: 'Apertura', value: openingAmount },
              { label: 'Ventas en efectivo', value: cashSales },
              { label: 'Efectivo esperado en caja', value: expectedCash },
            ].map(row => (
              <div key={row.label} className="pos-aqr">
                <span>{row.label}</span>
                <span className="av">${row.value.toLocaleString('es-CL')}</span>
              </div>
            ))}

            {/* Counted cash input */}
            <div className="pos-aqr">
              <span>Efectivo contado</span>
              <div className="flex items-center gap-1">
                <span className="av">$</span>
                <input
                  type="number"
                  value={countedCash}
                  onChange={e => setCountedCash(e.target.value)}
                  placeholder={expectedCash.toLocaleString('es-CL')}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--ink)',
                    background: 'var(--sunk)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    outline: 'none',
                    width: '8rem',
                    textAlign: 'right',
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                />
              </div>
            </div>

            {/* Difference */}
            <div className="pos-aqr diff">
              <span className="al">Diferencia</span>
              <span className="flex items-center gap-2">
                {hasCounted && difference === 0 ? (
                  <span className="pos-ok-tag">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                    Cuadrado
                  </span>
                ) : null}
                <span className="av" style={{ color: diffColor }}>
                  {hasCounted ? `$${Math.abs(difference).toLocaleString('es-CL')}` : '$–'}
                  {hasCounted && difference < 0 ? ' (faltante)' : ''}
                  {hasCounted && difference > 0 ? ' (sobrante)' : ''}
                </span>
              </span>
            </div>
          </div>

          {/* ── Warning: open accounts ──────────────── */}
          {confirmOpen && openAccounts.length > 0 && (
            <div className="pos-caja-open" style={{ flexDirection: 'column', alignItems: 'stretch', fontSize: 13 }}>
              <p className="co-t" style={{ marginBottom: 8 }}>
                Hay {openAccounts.length} cuenta{openAccounts.length > 1 ? 's' : ''} abierta{openAccounts.length > 1 ? 's' : ''}:
              </p>
              <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--ink-2)' }}>
                {openAccounts.map(a => (
                  <li key={a.id}>
                    {a.type === 'mesa' ? `Mesa ${a.table_number}` : a.type === 'mostrador' ? 'Mostrador' : `Retiro: ${a.customer_name}`}
                    {' · '}
                    <span className="co-s">${a.total.toLocaleString('es-CL')}</span>
                  </li>
                ))}
              </ul>
              <p className="co-t" style={{ marginTop: 8 }}>¿Cerrar caja de todas formas?</p>
            </div>
          )}

          {/* ── Action buttons ─────────────────────── */}
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
              onClick={() => toast.success('Imprimiendo cierre de caja')}
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
