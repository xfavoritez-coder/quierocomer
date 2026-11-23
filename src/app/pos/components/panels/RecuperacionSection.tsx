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
    surveysSent?: number; surveysOpened?: number
  }
  couponRecipients?: { name: string | null; email: string; phone: string | null; code: string | null; sentAt: string; opened: boolean; used: boolean }[]
  reasons: Record<string, number>
  surveyResponses: { customerName: string | null; customerEmail: string; customerPhone: string | null; reason: string | null; detail: string | null; comment: string | null; answeredAt: string; totalSpent: number }[]
  byAutomation: Record<string, { sent: number; opened: number; converted: number }>
  recent: { automation: string; status: string; customerName: string | null; customerEmail: string; couponCode: string | null; surveyReason: string | null; sentAt: string | null; openedAt: string | null; clickedAt: string | null; convertedAt: string | null; createdAt: string }[]
  queue: { email: string; name: string; orders: number; totalSpent: number; daysSinceLastOrder: number; avgFrequencyDays: number | null; status: string; riskScore: number; nextEmail?: string }[]
  queueTotal?: number
  recentSends?: { automation: string; sentAt: string; status: string; name: string | null; email: string; phone: string | null; clientStatus: string | null; orders: number | null; daysSinceLastOrder: number | null; avgFrequencyDays: number | null; minDays: number | null }[]
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
  const [queuePage, setQueuePage] = useState(0)
  const QUEUE_PAGE = 10

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
      <RecoverySummary k={k} queueCount={data.queueTotal ?? data.queue.length} couponRecipients={data.couponRecipients ?? []} onSelectClient={onSelectClient} />

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
            {(data.queueTotal ?? data.queue.length).toLocaleString('es-CL')} clientes cumplen hoy las reglas de envío y recibirán un email en la próxima ejecución diaria{(data.queueTotal ?? 0) > data.queue.length ? ` (se muestran los ${data.queue.length} de mayor riesgo)` : ''}. Solo se contacta a clientes perdidos que llevan al menos 45 días sin pedir (o 2,5× su frecuencia).{onSelectClient ? ' Toca un cliente para ver su detalle.' : ''}
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
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Próximo email</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Envío estimado</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.slice(queuePage * QUEUE_PAGE, (queuePage + 1) * QUEUE_PAGE).map((c, idx) => {
                  const i = queuePage * QUEUE_PAGE + idx
                  const daysUntil = Math.ceil((i + 1) / 50)
                  const sendDate = new Date(Date.now() + daysUntil * 86400000)
                  const sendLabel = sendDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
                  return (
                  <tr key={c.email} className="rec-queue-row" onClick={() => onSelectClient?.({ email: c.email, name: c.name || '', phone: '' })} style={{ borderBottom: '1px solid var(--line)', background: idx % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default' }}>
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
                      <AutomationBadge automation={c.nextEmail} />
                    </td>
                    <td style={{ padding: '8px 8px', fontFamily: M, fontSize: '0.72rem', color: '#3b82f6', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ~{sendLabel}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {data.queue.length > QUEUE_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
              {Array.from({ length: Math.ceil(data.queue.length / QUEUE_PAGE) }, (_, i) => (
                <button key={i} onClick={() => setQueuePage(i)} style={{
                  width: 28, height: 28, borderRadius: 6, fontFamily: M, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  border: queuePage === i ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  background: queuePage === i ? 'var(--ink)' : 'transparent',
                  color: queuePage === i ? '#fff' : 'var(--ink-2)',
                }}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {data.queue.length === 0 && k.contacted > 0 && (
        <div style={{ padding: '14px 18px', borderRadius: 12, border: '1px dashed var(--line)', fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-3)' }}>
          Nadie cumple hoy las reglas de envío: ningún cliente perdido llegó todavía a su umbral de días sin pedir, o ya fue contactado recientemente.
        </div>
      )}

      {/* ── Últimos envíos ── */}
      {(data.recentSends?.length ?? 0) > 0 && <RecentSends sends={data.recentSends!} onSelectClient={onSelectClient} />}

      {/* ── Estado vacío ── */}
      {k.contacted === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{enabled ? '✅' : '🔄'}</div>
          <h3 style={{ fontFamily: F, fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px' }}>
            {enabled ? 'Recuperación activada' : 'Recuperación Inteligente'}
          </h3>
          <p style={{ fontFamily: F, fontSize: '0.88rem', color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
            {enabled
              ? 'El sistema está activo. El cron diario analizará tus clientes y enviará emails automáticamente a los que dejen de comprar. Los resultados aparecerán aquí.'
              : 'Activa el sistema arriba para que QuieroComer detecte clientes que dejan de comprar y les envíe comunicaciones personalizadas.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
const fmt = (n: number) => n.toLocaleString('es-CL')

type Stat = { label: string; value: string; hint?: string; color?: string }

function StatGroup({ title, color, icon, stats, children }: { title: string; color: string; icon: React.ReactNode; stats: Stat[]; children?: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 800, color: 'var(--ink)' }}>{title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, gap: 8 }}>
        {stats.map((st, i) => (
          <div key={st.label} style={{ minWidth: 0, paddingLeft: i > 0 ? 10 : 0, borderLeft: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ fontFamily: F, fontSize: '1.3rem', fontWeight: 900, color: st.color ?? 'var(--ink)', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.value}</div>
            <div style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.25 }}>{st.label}</div>
            {st.hint && <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 500, color: 'var(--ink-4)', marginTop: 2 }}>{st.hint}</div>}
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

const ic = (d: React.ReactNode) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>

function RecoverySummary({ k, queueCount, couponRecipients, onSelectClient }: {
  k: RecoveryData['kpis']; queueCount: number
  couponRecipients: NonNullable<RecoveryData['couponRecipients']>
  onSelectClient?: (client: { email: string; name: string; phone: string }) => void
}) {
  const [showCoupons, setShowCoupons] = useState(false)
  const surveysSent = k.surveysSent ?? Math.max(0, k.contacted - k.couponsSent)
  const surveysOpened = k.surveysOpened ?? k.opened
  return (
    <div className="rec-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 10 }}>
      <StatGroup title="Clientes" color="#ef4444"
        icon={ic(<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></>)}
        stats={[
          { label: 'En riesgo', value: fmt(k.atRisk), color: '#d97706', hint: 'bajando frecuencia' },
          { label: 'Perdidos', value: fmt(k.churned), color: '#dc2626', hint: 'inactivos' },
          { label: 'Por contactar', value: fmt(queueCount), hint: 'próximo envío' },
        ]} />

      <StatGroup title="Encuestas" color="#3b82f6"
        icon={ic(<><path d="M4 4h16v16H4z"/><path d="m4 6 8 7 8-7"/></>)}
        stats={[
          { label: 'Enviadas', value: fmt(surveysSent) },
          { label: 'Abiertas', value: fmt(surveysOpened), hint: `${pct(surveysOpened, surveysSent)}%` },
          { label: 'Respondieron', value: fmt(k.responded), hint: `${pct(k.responded, surveysSent)}%` },
        ]} />

      <StatGroup title="Cupones" color="#f59e0b"
        icon={ic(<><path d="M3 9a3 3 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v14" strokeDasharray="2 2"/></>)}
        stats={[
          { label: 'Enviados', value: fmt(k.couponsSent) },
          { label: 'Abiertos', value: fmt(k.couponsOpened), hint: k.couponsSent ? `${pct(k.couponsOpened, k.couponsSent)}%` : undefined },
          { label: 'Usados', value: fmt(k.couponsUsed), color: k.couponsUsed > 0 ? '#16a34a' : undefined, hint: k.couponsSent ? `${pct(k.couponsUsed, k.couponsSent)}%` : undefined },
        ]}>
        {couponRecipients.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <button type="button" onClick={() => setShowCoupons(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F, fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-2)' }}>
              {showCoupons ? '▾' : '▸'} Ver a quién se envió
            </button>
            {showCoupons && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {couponRecipients.map(c => (
                  <div key={c.email + c.sentAt} onClick={() => onSelectClient?.({ email: c.email, name: c.name || '', phone: c.phone || '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default', fontFamily: F }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.email}</div>
                      <div style={{ fontSize: '0.64rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {new Date(c.sentAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}{c.code ? ` · ${c.code}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, flexShrink: 0,
                      background: c.used ? '#f0fdf4' : c.opened ? '#f5f3ff' : 'var(--surface)',
                      color: c.used ? '#16a34a' : c.opened ? '#7c3aed' : 'var(--ink-3)' }}>
                      {c.used ? 'Usado' : c.opened ? 'Abierto' : 'Enviado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </StatGroup>

      <StatGroup title="Resultados" color="#16a34a"
        icon={ic(<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>)}
        stats={[
          { label: 'Recuperados', value: fmt(k.recovered), color: k.recovered > 0 ? '#16a34a' : undefined, hint: k.contacted ? `${k.recoveryRate}% de contactados` : undefined },
          { label: 'Ingresos recuperados', value: clp(k.recoveredRevenue), color: k.recoveredRevenue > 0 ? '#16a34a' : undefined },
        ]} />
    </div>
  )
}

function AutomationBadge({ automation }: { automation?: string }) {
  const isCoupon = automation === 'recovery_incentive'
  return (
    <span style={{ fontFamily: F, fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap',
      background: isCoupon ? '#fffbeb' : '#eff6ff', color: isCoupon ? '#d97706' : '#2563eb' }}>
      {isCoupon ? 'Cupón' : 'Encuesta'}
    </span>
  )
}

const CLIENT_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  churned: { label: 'Perdido', bg: '#fef2f2', fg: '#dc2626' },
  at_risk: { label: 'En riesgo', bg: '#fffbeb', fg: '#d97706' },
  active: { label: 'Activo', bg: '#f0fdf4', fg: '#16a34a' },
  new: { label: 'Nuevo', bg: 'var(--sunk)', fg: 'var(--ink-3)' },
}

function RecentSends({ sends, onSelectClient }: { sends: NonNullable<RecoveryData['recentSends']>; onSelectClient?: (client: { email: string; name: string; phone: string }) => void }) {
  const [range, setRange] = useState<'today' | 'week'>('today')
  const [shown, setShown] = useState(10)
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const todayCount = sends.filter(s => new Date(s.sentAt) >= startOfToday).length
  const list = range === 'today' ? sends.filter(s => new Date(s.sentAt) >= startOfToday) : sends
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)' }}>Últimos envíos</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => { setRange('today'); setShown(10) }} style={{ ...pillBtn, ...(range === 'today' ? pillActive : {}) }}>Hoy ({todayCount})</button>
          <button onClick={() => { setRange('week'); setShown(10) }} style={{ ...pillBtn, ...(range === 'week' ? pillActive : {}) }}>7 días ({sends.length})</button>
        </div>
      </div>
      <div style={{ fontFamily: F, fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: 12 }}>
        A quién se le envió cada email y cómo está ese cliente hoy. "Sin pedir" muestra los días al momento actual y el mínimo que exigía la regla.
      </div>
      {list.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: '0.78rem', color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0', margin: 0 }}>Sin envíos {range === 'today' ? 'hoy' : 'en los últimos 7 días'}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.slice(0, shown).map((r, i) => {
            const st = r.clientStatus ? CLIENT_STATUS[r.clientStatus] : null
            const d = new Date(r.sentAt)
            const when = d >= startOfToday ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
            return (
              <div key={r.email + r.sentAt} onClick={() => onSelectClient?.({ email: r.email, name: r.name || '', phone: r.phone || '' })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 8, background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default', fontFamily: F }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || r.email}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <AutomationBadge automation={r.automation} />
                  {st
                    ? <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: st.bg, color: st.fg }}>{st.label}</span>
                    : <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--sunk)', color: 'var(--ink-3)' }}>Sin datos</span>}
                  {r.daysSinceLastOrder !== null && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                      <b>{r.daysSinceLastOrder}</b> días sin pedir{r.minDays !== null ? <span style={{ color: 'var(--ink-4)' }}> · mín. {r.minDays}</span> : null}
                      {r.avgFrequencyDays !== null ? <span style={{ color: 'var(--ink-3)' }}> · pedía cada {r.avgFrequencyDays}d</span> : null}
                    </span>
                  )}
                  <span style={{ fontFamily: M, fontSize: '0.66rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{when}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {list.length > shown && (
        <button onClick={() => setShown(n => n + 20)} style={{ ...pillBtn, display: 'block', margin: '10px auto 0' }}>Ver más ({list.length - shown})</button>
      )}
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
