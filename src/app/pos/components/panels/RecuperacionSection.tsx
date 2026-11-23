'use client'
import { useEffect, useState } from 'react'

const F = 'var(--sans)'
const M = 'var(--mono)'
const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

interface RecoveryData {
  kpis: {
    totalClients: number; withEmail: number
    atRisk: number; churned: number
    contacted: number; opened: number; responded: number; recovered: number
    recoveryRate: number; recoveredRevenue: number
    couponsSent: number; couponsOpened: number; couponsUsed: number
  }
  reasons: Record<string, number>
  surveyResponses: { customerName: string | null; customerEmail: string; customerPhone: string | null; reason: string | null; detail: string | null; comment: string | null; answeredAt: string; totalSpent: number }[]
  byAutomation: Record<string, { sent: number; opened: number; converted: number }>
  recent: { automation: string; status: string; customerName: string | null; customerEmail: string; couponCode: string | null; surveyReason: string | null; sentAt: string | null; openedAt: string | null; clickedAt: string | null; convertedAt: string | null; createdAt: string }[]
  queue: { email: string; name: string; orders: number; totalSpent: number; daysSinceLastOrder: number; avgFrequencyDays: number | null; status: string; riskScore: number }[]
}

const REASON_LABELS: Record<string, string> = {
  price: 'Precios altos', quality: 'Calidad', delivery_slow: 'Delivery lento',
  delivery_expensive: 'Delivery caro', delivery_time: 'Delivery', moved: 'Se mudó',
  competitor: 'Otro local', no_occasion: 'Sin ocasión', other: 'Otro',
}

export default function RecuperacionSection({ restaurantId, onSelectClient }: { restaurantId: string; allBranches?: { id: string }[]; onSelectClient?: (client: { email: string; name: string; phone: string }) => void }) {
  const [data, setData] = useState<RecoveryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [couponPercent, setCouponPercent] = useState(15)
  const [toggling, setToggling] = useState(false)
  const [savingPct, setSavingPct] = useState(false)
  const [respFilter, setRespFilter] = useState<string | null>(null)
  const [respSearch, setRespSearch] = useState('')
  const [respSort, setRespSort] = useState<'date' | 'spent'>('date')
  const [respPage, setRespPage] = useState(0)
  const RESP_PAGE = 8

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/panel/ecommerce/recovery?restaurantId=${restaurantId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/panel/ecommerce/recovery/settings?restaurantId=${restaurantId}`).then(r => r.ok ? r.json() : null),
    ]).then(([d, s]) => {
      if (d) setData(d)
      if (s) { setEnabled(s.enabled); if (s.couponPercent) setCouponPercent(s.couponPercent) }
    }).finally(() => setLoading(false))
  }, [restaurantId])

  const toggle = async () => {
    setToggling(true)
    try {
      const res = await fetch(`/api/panel/ecommerce/recovery/settings?restaurantId=${restaurantId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      if (res.ok) { const d = await res.json(); setEnabled(d.enabled) }
    } catch { /* noop */ }
    setToggling(false)
  }

  const savePct = async (pct: number) => {
    setSavingPct(true)
    try {
      await fetch(`/api/panel/ecommerce/recovery/settings?restaurantId=${restaurantId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponPercent: pct }),
      })
      setCouponPercent(pct)
    } catch { /* noop */ }
    setSavingPct(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--ink-3)', gap: 8, fontFamily: F, fontSize: '0.84rem' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Cargando...
    </div>
  )
  if (!data) return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: F }}>No se pudo cargar.</div>

  const k = data.kpis

  // Respuestas filtradas
  const allResp = data.surveyResponses
  const filteredResp = allResp
    .filter(r => !respFilter || r.reason === respFilter)
    .filter(r => !respSearch || (r.customerName || '').toLowerCase().includes(respSearch.toLowerCase()) || r.customerEmail.toLowerCase().includes(respSearch.toLowerCase()))
    .sort((a, b) => respSort === 'spent' ? b.totalSpent - a.totalSpent : new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
  const totalRespPages = Math.ceil(filteredResp.length / RESP_PAGE)
  const pageResp = filteredResp.slice(respPage * RESP_PAGE, (respPage + 1) * RESP_PAGE)

  // Razones únicas para filtro
  const reasonKeys = [...new Set(allResp.map(r => r.reason).filter(Boolean))] as string[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Control panel: toggle + descuento ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 20px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: F, fontSize: '0.92rem', fontWeight: 800, color: 'var(--ink)' }}>Recuperación Inteligente</div>
            <div style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)', marginTop: 2 }}>
              {enabled ? 'Activo — emails automáticos a clientes inactivos' : 'Desactivado'}
            </div>
          </div>
          <button onClick={toggle} disabled={toggling || enabled === null} style={{
            width: 50, height: 28, borderRadius: 14, border: 'none', cursor: toggling ? 'default' : 'pointer',
            background: enabled ? '#16a34a' : '#d1d5db', transition: 'background .2s', position: 'relative', flexShrink: 0,
            opacity: toggling ? 0.5 : 1,
          }}>
            <span style={{ position: 'absolute', top: 2, left: enabled ? 24 : 2, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
          </button>
        </div>
        {enabled && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)' }}>Descuento de recuperación</div>
              <div style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', marginTop: 1 }}>Cupón para clientes que no volvieron</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {[10, 15, 20, 25].map(pct => (
                <button key={pct} onClick={() => savePct(pct)} disabled={savingPct} style={{
                  padding: '5px 10px', borderRadius: 8, fontFamily: M, fontSize: '0.76rem', fontWeight: 800,
                  border: couponPercent === pct ? '2px solid var(--ink)' : '1.5px solid var(--line)',
                  background: couponPercent === pct ? 'var(--ink)' : 'transparent',
                  color: couponPercent === pct ? '#fff' : 'var(--ink-2)',
                  cursor: savingPct ? 'default' : 'pointer', opacity: savingPct ? 0.5 : 1,
                }}>{pct}%</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Resumen (embudo + estado de clientes) ── */}
      <RecoverySummary k={k} />

      {/* ── Motivos de abandono (barras) ── */}
      {Object.keys(data.reasons).length > 0 && (
        <div style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Motivos de abandono</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data.reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => {
              const total = Object.values(data.reasons).reduce((s, v) => s + v, 0)
              const pct = Math.round((count / total) * 100)
              return (
                <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: F, fontSize: '0.8rem', color: 'var(--ink)', minWidth: 110, fontWeight: 600 }}>{REASON_LABELS[reason] || reason}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sunk)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: '#f59e0b', transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontFamily: M, fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-2)', minWidth: 28, textAlign: 'right' }}>{count}</span>
                  <span style={{ fontFamily: M, fontSize: '0.68rem', color: 'var(--ink-3)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Respuestas (tabla con filtro + paginador) ── */}
      {allResp.length > 0 && (
        <div style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)' }}>Respuestas ({filteredResp.length})</span>
              <button onClick={() => { setRespSort(s => s === 'spent' ? 'date' : 'spent'); setRespPage(0) }} style={{ ...pillBtn, fontSize: '0.64rem', padding: '2px 7px' }}>
                {respSort === 'spent' ? '↓ Mayor gasto' : '↓ Recientes'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => { setRespFilter(null); setRespPage(0) }} style={{ ...pillBtn, ...(respFilter === null ? pillActive : {}) }}>Todos</button>
              {reasonKeys.map(r => (
                <button key={r} onClick={() => { setRespFilter(r); setRespPage(0) }} style={{ ...pillBtn, ...(respFilter === r ? pillActive : {}) }}>
                  {REASON_LABELS[r] || r}
                </button>
              ))}
            </div>
          </div>
          <input
            value={respSearch} onChange={e => { setRespSearch(e.target.value); setRespPage(0) }}
            placeholder="Buscar por nombre o email..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', fontFamily: F, fontSize: '0.8rem', color: 'var(--ink)', outline: 'none', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pageResp.map((r, i) => (
              <div key={i} onClick={() => onSelectClient?.({ email: r.customerEmail, name: r.customerName || '', phone: r.customerPhone || '' })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName || r.customerEmail}</div>
                  <div style={{ fontFamily: F, fontSize: '0.66rem', color: 'var(--ink-3)' }}>{r.customerEmail}{r.customerPhone ? ` · ${r.customerPhone}` : ''}</div>
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', flexShrink: 0 }}>
                  {REASON_LABELS[r.reason || ''] || r.reason || '—'}
                </span>
                <span style={{ fontFamily: M, fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink)', flexShrink: 0 }}>
                  {clp(r.totalSpent)}
                </span>
                <span style={{ fontFamily: M, fontSize: '0.68rem', color: 'var(--ink-3)', flexShrink: 0 }}>
                  {new Date(r.answeredAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                </span>
                {r.comment && (
                  <div style={{ fontFamily: F, fontSize: '0.78rem', color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.4, width: '100%', marginTop: 4 }}>
                    {"\u201C"}{r.comment}{"\u201D"}
                  </div>
                )}
              </div>
            ))}
          </div>
          {totalRespPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
              {Array.from({ length: totalRespPages }, (_, i) => (
                <button key={i} onClick={() => setRespPage(i)} style={{
                  width: 28, height: 28, borderRadius: 6, border: respPage === i ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  background: respPage === i ? 'var(--ink)' : 'transparent',
                  color: respPage === i ? '#fff' : 'var(--ink-2)',
                  fontFamily: M, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                }}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Cola de próximos envíos ── */}
      {data.queue.length > 0 && (
        <div style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
            Pendientes de contactar
          </div>
          <div style={{ fontFamily: F, fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: 12 }}>
            {data.queue.length} clientes en cola — recibirán el email de recuperación en las próximas ejecuciones del cron diario.{onSelectClient ? ' Toca un cliente para ver su detalle.' : ''}
          </div>
          <style>{`.rec-queue-row:hover{background:var(--sunk) !important}`}</style>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cliente</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Pedidos</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Total compras</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Sin pedir</th>
                  <th title="Cada cuántos días pedía en promedio" style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Frecuencia</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.map((c, i) => (
                  <tr key={c.email} className="rec-queue-row" onClick={() => onSelectClient?.({ email: c.email, name: c.name || '', phone: '' })} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default' }}>
                    <td style={{ padding: '8px 8px', maxWidth: 180 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.orders}</td>
                    <td style={{ padding: '8px 8px', fontFamily: M, fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{clp(c.totalSpent)}</td>
                    <td style={{ padding: '8px 8px', fontSize: '0.78rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: c.daysSinceLastOrder > 90 ? '#ef4444' : c.daysSinceLastOrder > 45 ? '#f59e0b' : 'var(--ink-2)' }}>
                      {c.daysSinceLastOrder} días
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: '0.78rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>
                      {c.avgFrequencyDays !== null ? `cada ${c.avgFrequencyDays} ${c.avgFrequencyDays === 1 ? 'día' : 'días'}` : <span style={{ color: 'var(--ink-4)' }}>1 pedido</span>}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                        background: c.status === 'churned' ? '#fef2f2' : '#fffbeb',
                        color: c.status === 'churned' ? '#dc2626' : '#d97706',
                      }}>
                        {c.status === 'churned' ? 'Perdido' : 'En riesgo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Estado vacío ── */}
      {k.contacted === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
          <h3 style={{ fontFamily: F, fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px' }}>Recuperación Inteligente</h3>
          <p style={{ fontFamily: F, fontSize: '0.88rem', color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
            Cuando se active, QuieroComer detectará clientes que dejan de comprar y les enviará comunicaciones personalizadas.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

function RecoverySummary({ k }: { k: RecoveryData['kpis'] }) {
  const steps = [
    { label: 'Enviadas', value: k.contacted, rate: null as number | null },
    { label: 'Abiertas', value: k.opened, rate: pct(k.opened, k.contacted) },
    { label: 'Respondieron', value: k.responded, rate: pct(k.responded, k.contacted) },
    { label: 'Volvieron', value: k.recovered, rate: pct(k.recovered, k.contacted) },
  ]
  const label: React.CSSProperties = { fontFamily: F, fontSize: '0.62rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em' }
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>
      <style>{`
        .rec-funnel{display:grid;grid-template-columns:repeat(4,1fr)}
        .rec-funnel > div + div{border-left:1px solid var(--line)}
        @media (max-width:560px){
          .rec-funnel{grid-template-columns:repeat(2,1fr)}
          .rec-funnel > div:nth-child(3){border-left:none}
          .rec-funnel > div:nth-child(n+3){border-top:1px solid var(--line)}
        }
      `}</style>

      {/* Header: ingresos recuperados */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px 12px' }}>
        <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)' }}>Resultados</span>
        <span style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)' }}>
          Ingresos recuperados <b style={{ fontFamily: M, fontSize: '0.9rem', color: k.recoveredRevenue > 0 ? '#16a34a' : 'var(--ink)', marginLeft: 4 }}>{clp(k.recoveredRevenue)}</b>
        </span>
      </div>

      {/* Embudo */}
      <div className="rec-funnel" style={{ borderTop: '1px solid var(--line)' }}>
        {steps.map((st, i) => (
          <div key={st.label} style={{ padding: '12px 18px' }}>
            <div style={label}>{st.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontFamily: F, fontSize: '1.35rem', fontWeight: 900, color: i === 3 && st.value > 0 ? '#16a34a' : 'var(--ink)', lineHeight: 1 }}>{st.value.toLocaleString('es-CL')}</span>
              {st.rate !== null && <span style={{ fontFamily: M, fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)' }}>{st.rate}%</span>}
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--sunk)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${st.rate === null ? 100 : Math.max(st.value > 0 ? 3 : 0, st.rate)}%`, background: i === 3 ? '#16a34a' : '#3b82f6', opacity: 1 - i * 0.18, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer: estado de clientes + cupones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 18px', padding: '11px 18px', borderTop: '1px solid var(--line)', background: 'var(--sunk)', fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-2)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
          <b style={{ color: 'var(--ink)' }}>{k.atRisk.toLocaleString('es-CL')}</b> en riesgo
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
          <b style={{ color: 'var(--ink)' }}>{k.churned.toLocaleString('es-CL')}</b> perdidos
        </span>
        {k.couponsSent > 0 && (
          <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
            Cupones: <b style={{ color: 'var(--ink)' }}>{k.couponsSent}</b> enviados · <b style={{ color: 'var(--ink)' }}>{k.couponsOpened}</b> abiertos · <b style={{ color: '#16a34a' }}>{k.couponsUsed}</b> usados
          </span>
        )}
      </div>
    </div>
  )
}

const pillBtn: React.CSSProperties = {
  padding: '3px 9px', borderRadius: 6, fontFamily: 'var(--sans)', fontSize: '0.68rem', fontWeight: 600,
  border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer',
}
const pillActive: React.CSSProperties = {
  background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)',
}
