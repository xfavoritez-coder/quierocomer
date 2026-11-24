'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

const F = 'var(--sans)'
const M = 'var(--mono)'
const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')
// Tope práctico de envíos por ejecución diaria del cron (presupuesto de 240s con
// ~500ms entre correos). Solo para estimar el ritmo en el panel; el cron no usa la
// tabla de 50 que se muestra abajo, re-segmenta todo y envía hasta este tope.
const DAILY_SEND_CAP = 480
// El cron de recuperación corre a las 14:00 UTC (≈11:00 Chile en horario de verano).
const CRON_HOUR_UTC = 14
/** Próxima corrida del cron: hoy a las 14:00 UTC si aún no pasó, si no mañana. */
function nextCronRunDate(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setUTCHours(CRON_HOUR_UTC, 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1)
  return d
}

interface RecoveryData {
  kpis: {
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
  recoveredClients?: { name: string | null; email: string; phone: string | null; orderId: string; orderTotal: number; orderDate: string; branchName: string | null; usedCoupon: boolean; items: { name: string; qty: number; price: number }[] }[]
}

/** Datos pesados (cola, envíos recientes) — se cargan lazy después de los KPIs. */
interface QueueData {
  queue: { email: string; name: string; orders: number; totalSpent: number; daysSinceLastOrder: number; avgFrequencyDays: number | null; status: string; riskScore: number; nextEmail?: string; daysLeft?: number; minDays?: number }[]
  queueTotal: number; pendingSurvey: number; pendingCoupon: number
  recentSends: { automation: string; sentAt: string; status: string; name: string | null; email: string; phone: string | null; clientStatus: string | null; orders: number | null; daysSinceLastOrder: number | null; avgFrequencyDays: number | null; minDays: number | null; surveySentAt?: string | null }[]
  atRisk: number; churned: number
}

const REASON_LABELS: Record<string, string> = {
  price: 'Precios altos', quality: 'Calidad', delivery_slow: 'Delivery lento',
  delivery_expensive: 'Delivery caro', delivery_time: 'Delivery', moved: 'Se mudó',
  competitor: 'Otro local', no_occasion: 'Sin ocasión', other: 'Otro',
}

export default function RecuperacionSection({ restaurantId, onSelectClient }: { restaurantId: string; allBranches?: { id: string }[]; onSelectClient?: (client: { email: string; name: string; phone: string }) => void }) {
  const [data, setData] = useState<RecoveryData | null>(null)
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [couponPercent, setCouponPercent] = useState(15)
  const [toggling, setToggling] = useState(false)
  const [savingPct, setSavingPct] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [respFilter, setRespFilter] = useState<string | null>(null)
  const [respSearch, setRespSearch] = useState('')
  const [respSort, setRespSort] = useState<'date' | 'spent'>('date')
  const [respPage, setRespPage] = useState(0)
  const RESP_PAGE = 8
  const [queuePage, setQueuePage] = useState(0)
  const QUEUE_PAGE = 10

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      // Fase 1: KPIs rápidos (solo enrollments, sin segmentación de clientes)
      const [d, s, imp] = await Promise.all([
        fetch(`/api/panel/ecommerce/recovery?restaurantId=${restaurantId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/panel/ecommerce/recovery/settings?restaurantId=${restaurantId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/panel/ecommerce/recovery/import?restaurantId=${restaurantId}`).then(r => r.ok ? r.json() : null),
      ])
      if (d) setData(d)
      if (s) { setEnabled(s.enabled); if (s.couponPercent) setCouponPercent(s.couponPercent) }
      if (imp && typeof imp.count === 'number') setImportedCount(imp.count)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
    // Fase 2: datos pesados (cola, segmentación) — en background
    fetch(`/api/panel/ecommerce/recovery?restaurantId=${restaurantId}&section=queue`)
      .then(r => r.ok ? r.json() : null)
      .then(q => { if (q) setQueueData(q) })
      .catch(() => {})
  }, [restaurantId])

  useEffect(() => { loadData() }, [loadData])

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

  const onPickFile = () => fileRef.current?.click()
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadFile(file)
  }
  const uploadFile = async (file: File) => {
    setImportBusy(true); setImportMsg(null)
    try {
      const text = await file.text()
      const res = await fetch(`/api/panel/ecommerce/recovery/import?restaurantId=${restaurantId}`, {
        method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text,
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) {
        setImportMsg({ ok: false, text: d?.error || 'No se pudo procesar el archivo.' })
      } else {
        const parts = [`${d.added} agregados`]
        if (d.updated) parts.push(`${d.updated} actualizados`)
        if (d.duplicatesInFile) parts.push(`${d.duplicatesInFile} duplicados`)
        if (d.invalid) parts.push(`${d.invalid} inválidos`)
        setImportMsg({ ok: true, text: `Columna "${d.emailColumn}" · ${parts.join(' · ')}. Total guardado: ${d.total}.${d.truncated ? ' (máximo alcanzado)' : ''}` })
        await loadData({ silent: true })
      }
    } catch {
      setImportMsg({ ok: false, text: 'Error leyendo el archivo.' })
    }
    setImportBusy(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--ink-3)', gap: 8, fontFamily: F, fontSize: '0.84rem' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Cargando...
    </div>
  )
  if (!data) return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: F }}>No se pudo cargar.</div>

  const k = data.kpis
  const pendingTotal = queueData?.queueTotal ?? 0
  const daysToContactAll = Math.max(1, Math.ceil(pendingTotal / DAILY_SEND_CAP))
  const nextRun = nextCronRunDate()
  const nextRunDay = nextRun.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'short' })
  const nextRunTime = nextRun.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' })

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

        {/* ── Importar listado de correos (clientes perdidos manuales) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 220px' }}>
              <div style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)' }}>Importar clientes perdidos</div>
              <div style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', marginTop: 1 }}>
                Sube un CSV con correos. Los que no tengan pedidos entran como perdidos y recibirán la recuperación.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {importedCount > 0 && (
                <span style={{ fontFamily: M, fontSize: '0.7rem', color: 'var(--ink-2)', fontWeight: 700, whiteSpace: 'nowrap' }}>{importedCount.toLocaleString('es-CL')} cargados</span>
              )}
              <button onClick={onPickFile} disabled={importBusy} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
                border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontFamily: F, fontSize: '0.76rem', fontWeight: 700,
                cursor: importBusy ? 'default' : 'pointer', opacity: importBusy ? 0.5 : 1, whiteSpace: 'nowrap',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V5M8 9l4-4 4 4M5 19h14"/></svg>
                {importBusy ? 'Subiendo…' : importedCount > 0 ? 'Agregar más' : 'Subir CSV'}
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFileChange} style={{ display: 'none' }} />
          {importMsg && (
            <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 600, padding: '7px 10px', borderRadius: 8,
              background: importMsg.ok ? '#f0fdf4' : '#fef2f2', color: importMsg.ok ? '#16a34a' : '#dc2626',
              border: `1px solid ${importMsg.ok ? '#bbf7d0' : '#fecaca'}` }}>
              {importMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── Resumen (embudo + estado de clientes) ── */}
      <RecoverySummary k={k} queueCount={queueData?.queueTotal ?? 0} pendingSurvey={queueData?.pendingSurvey ?? 0} pendingCoupon={queueData?.pendingCoupon ?? 0} atRisk={queueData?.atRisk ?? 0} churned={queueData?.churned ?? 0} couponRecipients={data.couponRecipients ?? []} recoveredClients={data.recoveredClients ?? []} onSelectClient={onSelectClient} />

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
      {(queueData?.queue?.length ?? 0) > 0 && (
        <div style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
            Pendientes de contactar
          </div>
          <div style={{ fontFamily: F, fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: 12 }}>
            {(queueData?.queueTotal ?? 0).toLocaleString('es-CL')} clientes pendientes. Se contacta a quienes llevan 30+ días sin pedir (o 2,5× su frecuencia habitual). Primero reciben la encuesta, y 3 días después el cupón de descuento.
          </div>
          {/* Indicador de ritmo: el cron envía hasta ~480/día, no los 50 que se listan. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12, padding: '9px 11px', borderRadius: 10, background: 'var(--amber-tint-2)', border: '1px solid var(--amber-tint)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--amber-tint)', fontFamily: F, fontSize: '0.74rem', fontWeight: 800, color: 'var(--amber-press)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>
              ~{DAILY_SEND_CAP} correos/día
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--line)', fontFamily: F, fontSize: '0.74rem', fontWeight: 800, color: 'var(--ink-2)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              ~{daysToContactAll.toLocaleString('es-CL')} {daysToContactAll === 1 ? 'día' : 'días'} para contactarlos a todos
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, background: 'var(--jade-tint)', border: '1px solid var(--jade-tint)', fontFamily: F, fontSize: '0.74rem', fontWeight: 800, color: 'var(--jade)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>
              Próximo envío: {nextRunDay} · {nextRunTime}
            </span>
          </div>
          <style>{`.rec-queue-row:hover{background:var(--sunk) !important}`}</style>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cliente</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Pedidos</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Total compras</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Último pedido</th>
                  <th title="Cada cuántos días pedía en promedio" style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Frecuencia</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Próximo email</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Envío estimado</th>
                </tr>
              </thead>
              <tbody>
                {(queueData?.queue ?? []).slice(queuePage * QUEUE_PAGE, (queuePage + 1) * QUEUE_PAGE).map((c, idx) => {
                  const i = queuePage * QUEUE_PAGE + idx
                  const daysLeft = c.daysLeft ?? 0
                  const sendDate = new Date(Date.now() + Math.max(1, daysLeft) * 86400000)
                  const sendLabel = daysLeft === 0 ? 'Hoy' : sendDate.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'short' })
                  return (
                  <tr key={c.email} className="rec-queue-row" onClick={() => onSelectClient?.({ email: c.email, name: c.name || '', phone: '' })} style={{ borderBottom: '1px solid var(--line)', background: idx % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default' }}>
                    <td style={{ padding: '8px 8px', maxWidth: 180 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.orders}</td>
                    <td style={{ padding: '8px 8px', fontFamily: M, fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{clp(c.totalSpent)}</td>
                    <td style={{ padding: '8px 8px', fontSize: '0.76rem', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>
                      <div style={{ fontWeight: 600 }}>{new Date(Date.now() - c.daysSinceLastOrder * 86400000).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</div>
                      <div style={{ fontSize: '0.64rem', color: c.daysSinceLastOrder > 90 ? '#ef4444' : c.daysSinceLastOrder > 45 ? '#f59e0b' : 'var(--ink-3)' }}>hace {c.daysSinceLastOrder}d</div>
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: '0.78rem', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>
                      {c.avgFrequencyDays !== null ? `cada ${c.avgFrequencyDays} ${c.avgFrequencyDays === 1 ? 'día' : 'días'}` : <span style={{ color: 'var(--ink-4)' }}>1 pedido</span>}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                      <AutomationBadge automation={c.nextEmail} />
                    </td>
                    <td style={{ padding: '8px 8px', fontFamily: M, fontSize: '0.72rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: daysLeft === 0 ? '#16a34a' : daysLeft <= 7 ? '#3b82f6' : 'var(--ink-3)' }}>
                      {daysLeft === 0 ? '🟢 Hoy' : `~${sendLabel}`}
                      {daysLeft > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--ink-4)', marginLeft: 4 }}>({daysLeft}d)</span>}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(queueData?.queue?.length ?? 0) > QUEUE_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
              {Array.from({ length: Math.ceil((queueData?.queue?.length ?? 0) / QUEUE_PAGE) }, (_, i) => (
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

      {queueData && (queueData.queue?.length ?? 0) === 0 && k.contacted > 0 && (
        <div style={{ padding: '14px 18px', borderRadius: 12, border: '1px dashed var(--line)', fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-3)' }}>
          Todos los clientes perdidos ya han sido contactados. Cuando nuevos clientes cumplan el umbral de inactividad, aparecerán aquí.
        </div>
      )}

      {/* ── Últimos envíos ── */}
      {(queueData?.recentSends?.length ?? 0) > 0 && <RecentSends sends={queueData!.recentSends} onSelectClient={onSelectClient} />}

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

type Stat = { label: string; value: string; hint?: string; color?: string; onClick?: () => void }

function StatGroup({ title, color, icon, stats, children }: { title: string; color: string; icon: React.ReactNode; stats: Stat[]; children?: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 800, color: 'var(--ink)' }}>{title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, gap: 8 }}>
        {stats.map((st, i) => (
          <div key={st.label} onClick={st.onClick} style={{ minWidth: 0, paddingLeft: i > 0 ? 10 : 0, borderLeft: i > 0 ? '1px solid var(--line)' : 'none', cursor: st.onClick ? 'pointer' : undefined, borderRadius: st.onClick ? 8 : undefined, padding: st.onClick ? '4px 6px' : undefined, transition: 'background .15s' }}
            onMouseEnter={st.onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'var(--sunk)' } : undefined}
            onMouseLeave={st.onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = '' } : undefined}>
            <div style={{ fontFamily: F, fontSize: '1.3rem', fontWeight: 900, color: st.color ?? 'var(--ink)', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.value}</div>
            <div style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 600, color: st.onClick ? (st.color ?? 'var(--ink-2)') : 'var(--ink-3)', marginTop: 4, lineHeight: 1.25, textDecoration: st.onClick ? 'underline' : undefined, textDecorationStyle: st.onClick ? 'dotted' as const : undefined, textUnderlineOffset: st.onClick ? '2px' : undefined }}>
              {st.label}{st.onClick ? ' ↗' : ''}
            </div>
            {st.hint && <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 500, color: 'var(--ink-4)', marginTop: 2 }}>{st.hint}</div>}
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

const ic = (d: React.ReactNode) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>

function RecoverySummary({ k, queueCount, pendingSurvey, pendingCoupon, atRisk, churned, couponRecipients, recoveredClients, onSelectClient }: {
  k: RecoveryData['kpis']; queueCount: number; pendingSurvey: number; pendingCoupon: number; atRisk: number; churned: number
  couponRecipients: NonNullable<RecoveryData['couponRecipients']>
  recoveredClients: NonNullable<RecoveryData['recoveredClients']>
  onSelectClient?: (client: { email: string; name: string; phone: string }) => void
}) {
  const [showCoupons, setShowCoupons] = useState(false)
  const [showRecovered, setShowRecovered] = useState(false)
  const surveysSent = k.surveysSent ?? Math.max(0, k.contacted - k.couponsSent)
  const surveysOpened = k.surveysOpened ?? k.opened
  return (
    <div className="rec-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 10 }}>
      <StatGroup title="Clientes" color="#ef4444"
        icon={ic(<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></>)}
        stats={[
          { label: 'En riesgo', value: atRisk ? fmt(atRisk) : '…', color: '#d97706', hint: 'bajando frecuencia' },
          { label: 'Perdidos', value: churned ? fmt(churned) : '…', color: '#dc2626', hint: 'inactivos' },
          { label: 'Pend. encuesta', value: pendingSurvey || queueCount ? fmt(pendingSurvey) : '…', hint: 'esperan umbral' },
          { label: 'Pend. cupón', value: pendingCoupon || queueCount ? fmt(pendingCoupon) : '…', color: '#16a34a', hint: 'esperan 3 días' },
        ]} />

      <StatGroup title="Encuestas" color="#3b82f6"
        icon={ic(<><path d="M4 4h16v16H4z"/><path d="m4 6 8 7 8-7"/></>)}
        stats={[
          { label: 'Enviadas', value: fmt(surveysSent) },
          { label: 'Interactuaron', value: fmt(surveysOpened), hint: `${pct(surveysOpened, surveysSent)}%` },
          { label: 'Respondieron', value: fmt(k.responded), hint: `${pct(k.responded, surveysSent)}%` },
        ]} />

      <StatGroup title="Cupones" color="#f59e0b"
        icon={ic(<><path d="M3 9a3 3 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v14" strokeDasharray="2 2"/></>)}
        stats={[
          { label: 'Enviados', value: fmt(k.couponsSent), onClick: k.couponsSent > 0 ? () => setShowCoupons(v => !v) : undefined },
          { label: 'Interactuaron', value: fmt(k.couponsOpened), hint: k.couponsSent ? `${pct(k.couponsOpened, k.couponsSent)}%` : undefined },
          { label: 'Usados', value: fmt(k.couponsUsed), color: k.couponsUsed > 0 ? '#16a34a' : undefined, hint: k.couponsSent ? `${pct(k.couponsUsed, k.couponsSent)}%` : undefined },
        ]}>
        {showCoupons && couponRecipients.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, maxHeight: 320, overflowY: 'auto' }}>
            <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink-2)', marginBottom: 6 }}>Cupones enviados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    {c.used ? 'Usado' : c.opened ? 'Interactuó' : 'Enviado'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </StatGroup>

      <StatGroup title="Resultados" color="#16a34a"
        icon={ic(<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>)}
        stats={[
          { label: 'Recuperados', value: fmt(k.recovered), color: k.recovered > 0 ? '#16a34a' : undefined, hint: k.contacted ? `${k.recovered && k.contacted ? (k.recovered / k.contacted * 100 < 1 ? (k.recovered / k.contacted * 100).toFixed(1) : Math.round(k.recovered / k.contacted * 100).toString()) : '0'}% de contactados` : undefined, onClick: k.recovered > 0 ? () => setShowRecovered(v => !v) : undefined },
          { label: 'Ingresos recuperados', value: clp(k.recoveredRevenue), color: k.recoveredRevenue > 0 ? '#16a34a' : undefined },
        ]}>
        {showRecovered && recoveredClients.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink-2)', marginBottom: 2 }}>Clientes que volvieron a pedir</div>
            {recoveredClients.map(c => (
              <div key={c.orderId} onClick={() => onSelectClient?.({ email: c.email, name: c.name || '', phone: c.phone || '' })}
                style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default', fontFamily: F }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.email}</div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                  </div>
                  <span style={{ fontFamily: M, fontSize: '0.82rem', fontWeight: 900, color: '#16a34a', flexShrink: 0 }}>{clp(c.orderTotal)}</span>
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--ink-3)', lineHeight: 1.4, marginTop: 2 }}>
                  {new Date(c.orderDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {c.branchName ? ` \u00B7 ${c.branchName}` : ''}
                  {c.usedCoupon ? ' \u00B7 \uD83C\uDF81 Us\u00F3 cup\u00F3n' : ' \u00B7 sin cup\u00F3n'}
                </div>
                {c.items.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.items.slice(0, 5).map((it, i) => (
                      <span key={i} style={{ fontSize: '0.62rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {it.qty > 1 ? `${it.qty}x ` : ''}{it.name}
                      </span>
                    ))}
                    {c.items.length > 5 && <span style={{ fontSize: '0.62rem', color: 'var(--ink-4)' }}>+{c.items.length - 5} m\u00E1s</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </StatGroup>
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

function RecentSends({ sends, onSelectClient }: { sends: QueueData['recentSends']; onSelectClient?: (client: { email: string; name: string; phone: string }) => void }) {
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
        A quién se le envió cada email y cómo está ese cliente hoy. &quot;Sin pedir&quot; muestra los días al momento actual y el mínimo que exigía la regla.
      </div>
      {list.length === 0 ? (
        <p style={{ fontFamily: F, fontSize: '0.78rem', color: 'var(--ink-3)', textAlign: 'center', padding: '12px 0', margin: 0 }}>Sin envíos {range === 'today' ? 'hoy' : 'en los últimos 7 días'}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(() => {
            // Sets para saber si un email tiene encuesta/cupón
            const hasSurvey = new Set(sends.filter(s => s.automation === 'abandonment_survey').map(s => s.email.toLowerCase()))
            const hasCoupon = new Set(sends.filter(s => s.automation === 'recovery_incentive').map(s => s.email.toLowerCase()))
            return list.slice(0, shown).map((r, i) => {
            const st = r.clientStatus ? CLIENT_STATUS[r.clientStatus] : null
            const d = new Date(r.sentAt)
            const when = d >= startOfToday ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
            const em = r.email.toLowerCase()
            return (
              <div key={r.email + r.sentAt} onClick={() => onSelectClient?.({ email: r.email, name: r.name || '', phone: r.phone || '' })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 8, background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: onSelectClient ? 'pointer' : 'default', fontFamily: F }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || r.email}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {hasSurvey.has(em) && <AutomationBadge automation="abandonment_survey" />}
                  {hasCoupon.has(em) && <AutomationBadge automation="recovery_incentive" />}
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
          })
          })()}
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
