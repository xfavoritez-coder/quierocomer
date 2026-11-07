'use client'

import { useState } from 'react'
import { useClosedCajas, cashHistoryApi } from '@/lib/pos/cashApi'
import type { CashSession } from '@/lib/pos'
import { v4 as uuidv4 } from 'uuid'
import { printCashClose, getBridgeUrl } from '@/lib/pos/bridge'
import { toast } from 'sonner'
import { usePosRestaurant } from '../lib/usePosRestaurant'

const METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  app_pago: 'App de pago',
  webpay: 'Webpay',
}
const labelFor = (m: string) => METHOD_LABELS[m] ?? m // plataformas ya vienen como etiqueta

// Deriva los datos de venta de una sesión cerrada. El efectivo esperado incluye
// la apertura, así que la venta en efectivo = esperado − apertura. El total de
// ventas se prefiere del snapshot guardado (cierres nuevos) y si no, se recalcula.
function deriveSession(s: CashSession) {
  const opening = s.initial_amount || 0
  const exp = s.expected_amounts || {}
  const cnt = s.counted_amounts || {}
  const salesFor = (m: string) => (m === 'efectivo' ? Math.max(0, (exp[m] || 0) - opening) : (exp[m] || 0))
  const methods = Object.keys(exp)
    .map(m => ({ key: m, label: labelFor(m), amount: salesFor(m) }))
    .filter(x => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const computedTotal = methods.reduce((t, x) => t + x.amount, 0)
  const totalSales = s.total_sales != null ? s.total_sales : computedTotal
  const cashExpected = exp['efectivo'] || 0
  const cashCounted = cnt['efectivo'] != null ? cnt['efectivo'] : cashExpected
  const cashSales = Math.max(0, cashExpected - opening)
  return {
    opening, methods, totalSales,
    totalTips: s.total_tips ?? 0,
    closedAccounts: s.closed_accounts ?? 0,
    cashExpected, cashCounted, cashSales,
    difference: s.difference || 0,
    note: s.note,
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dayLabel = (iso?: string) => (iso ? cap(new Date(iso).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })) : '—')
const monthLabel = (d: Date) => cap(d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
const timeLabel = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '--:--')

/** Lista de cierres de caja agrupados por mes, con desglose y reimpresión.
 *  Presentacional: el contenedor (ruta o panel) provee el scroll/título. */
export default function PosCajaHistorial({ restaurantId }: { restaurantId: string }) {
  const { restaurant } = usePosRestaurant()
  const { sessions, reload } = useClosedCajas(restaurantId)
  const [open, setOpen] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const handleDelete = async (s: CashSession) => {
    try {
      await cashHistoryApi.deleteCaja(restaurantId, s.id)
      toast.success('Cierre eliminado del historial')
      reload()
    } catch {
      toast.error('No se pudo eliminar')
    } finally {
      setConfirmDel(null)
    }
  }

  const reprint = async (s: CashSession) => {
    if (!getBridgeUrl()) { toast.error('No hay agente de impresión configurado'); return }
    const d = deriveSession(s)
    const r = await printCashClose({
      jobId: 'cierre_' + uuidv4(),
      restaurantName: restaurant?.name,
      date: s.closed_at ? new Date(s.closed_at).toLocaleDateString('es-CL') : '',
      openedAt: timeLabel(s.opened_at),
      closedAt: timeLabel(s.closed_at),
      closedAccounts: d.closedAccounts,
      methods: d.methods.map(m => ({ label: m.label, amount: m.amount, count: 0 })),
      totalTips: d.totalTips,
      totalSales: d.totalSales,
      opening: d.opening,
      cashSales: d.cashSales,
      expectedCash: d.cashExpected,
      countedCash: d.cashCounted,
      difference: d.difference,
      note: d.note,
    })
    if (r.ok) toast.success('Cierre reenviado a la impresora')
    else toast.error(r.error || 'No se pudo imprimir')
  }

  if (sessions.length === 0) {
    return (
      <div className="pos-empty" style={{ minHeight: 160 }}>
        <div className="ring">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
          </svg>
        </div>
        <p>Aún no hay cierres de caja</p>
      </div>
    )
  }

  // Agrupa por mes (las sesiones ya vienen de más reciente a más antigua).
  const groups: { key: string; label: string; total: number; items: CashSession[] }[] = []
  for (const s of sessions) {
    const dt = new Date(s.closed_at || s.opened_at)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, label: monthLabel(dt), total: 0, items: [] }; groups.push(g) }
    g.items.push(s)
    g.total += deriveSession(s).totalSales
  }

  return (
    <>
      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 8 }}>
          <div className="pos-eyebrow" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '4px 2px 10px' }}>
            <span>{g.label}</span>
            <b style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}>${g.total.toLocaleString('es-CL')}</b>
          </div>
          {g.items.map(s => {
            const d = deriveSession(s)
            const isOpen = open === s.id
            const diffColor = d.difference === 0 ? 'var(--ink-3)' : d.difference < 0 ? '#C53030' : 'var(--amber-press)'
            return (
              <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-1)', marginBottom: 12, overflow: 'hidden' }}>

                {/* Cabecera clickeable */}
                <button
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{dayLabel(s.closed_at)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {timeLabel(s.opened_at)} → {timeLabel(s.closed_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>${d.totalSales.toLocaleString('es-CL')}</div>
                      {d.difference !== 0 && (
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: diffColor }}>
                          {d.difference < 0 ? 'Faltó' : 'Sobró'} ${Math.abs(d.difference).toLocaleString('es-CL')}
                        </div>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                </button>

                {/* Detalle */}
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line)' }}>
                    {d.methods.length > 0 ? (
                      <div className="pos-mgrid" style={{ marginTop: 14 }}>
                        {d.methods.map(m => (
                          <div key={m.key} className="pos-mcard">
                            <div className="ml">{m.label}</div>
                            <div className="mv">${m.amount.toLocaleString('es-CL')}</div>
                          </div>
                        ))}
                        {d.totalTips > 0 && (
                          <div className="pos-mcard" style={{ gridColumn: 'span 2' }}>
                            <div className="ml">Propinas</div>
                            <div className="mv">${d.totalTips.toLocaleString('es-CL')}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 14 }}>Sin ventas registradas en el turno.</p>
                    )}

                    <div className="pos-arqueo" style={{ marginTop: 14 }}>
                      <h4>Arqueo de efectivo</h4>
                      {[
                        { label: 'Apertura', value: d.opening },
                        { label: 'Ventas en efectivo', value: d.cashSales },
                        { label: 'Efectivo esperado', value: d.cashExpected },
                        { label: 'Efectivo contado', value: d.cashCounted },
                      ].map(row => (
                        <div key={row.label} className="pos-aqr">
                          <span>{row.label}</span>
                          <span className="av">${row.value.toLocaleString('es-CL')}</span>
                        </div>
                      ))}
                      <div className="pos-aqr diff">
                        <span className="al">Diferencia</span>
                        <span className="av" style={{ color: diffColor }}>
                          {d.difference === 0
                            ? 'Cuadrado'
                            : `$${Math.abs(d.difference).toLocaleString('es-CL')}${d.difference < 0 ? ' (faltante)' : ' (sobrante)'}`}
                        </span>
                      </div>
                    </div>

                    {d.closedAccounts > 0 && (
                      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10 }}>{d.closedAccounts} cuenta{d.closedAccounts === 1 ? '' : 's'} cobrada{d.closedAccounts === 1 ? '' : 's'} en el turno.</p>
                    )}

                    {d.note && (
                      <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                        <span style={{ fontWeight: 600 }}>Nota: </span>{d.note}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button
                        onClick={() => reprint(s)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="6" y="3" width="12" height="6"/><rect x="6" y="14" width="12" height="7"/>
                          <path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>
                        </svg>
                        Reimprimir
                      </button>
                      <button
                        onClick={() => setConfirmDel(confirmDel === s.id ? null : s.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 14px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--surface)', color: '#C53030', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                        Eliminar
                      </button>
                    </div>

                    {confirmDel === s.id && (
                      <div style={{ marginTop: 10, padding: '12px', borderRadius: 10, border: '1px solid #C53030', background: 'var(--sunk)' }}>
                        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>
                          ¿Eliminar este cierre del historial? No afecta ventas ni pedidos, solo quita el registro del arqueo. Se aplica en todos los equipos.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleDelete(s)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--r-btn)', border: 0, background: '#C53030', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Sí, eliminar</button>
                          <button onClick={() => setConfirmDel(null)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--r-btn)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}
