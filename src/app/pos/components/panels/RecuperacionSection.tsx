'use client'
import { useEffect, useState } from 'react'

const F = 'var(--sans)'
const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

interface RecoveryData {
  kpis: {
    totalClients: number; withEmail: number
    atRisk: number; atRiskWithEmail: number
    churned: number; churnedWithEmail: number
    contacted: number; opened: number; recovered: number
    recoveryRate: number; recoveredRevenue: number
  }
  reasons: Record<string, number>
  byAutomation: Record<string, { sent: number; opened: number; converted: number }>
  recent: { automation: string; status: string; customerName: string | null; customerEmail: string; sentAt: string | null; convertedAt: string | null; createdAt: string }[]
  atRiskClients: { email: string; name: string; phone: string; orders: number; avgTicket: number; totalSpent: number; daysSinceLastOrder: number; avgFrequencyDays: number | null; status: string; riskScore: number; topProduct: string | null }[]
}

const AUTOMATION_LABELS: Record<string, string> = {
  first_buyer: 'Primer comprador',
  at_risk: 'En riesgo',
  abandonment_survey: 'Encuesta abandono',
  recovery_incentive: 'Incentivo',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#94a3b8' },
  sent: { label: 'Enviado', color: '#3b82f6' },
  delivered: { label: 'Entregado', color: '#3b82f6' },
  opened: { label: 'Abierto', color: '#8b5cf6' },
  clicked: { label: 'Click', color: '#8b5cf6' },
  converted: { label: 'Recuperado', color: '#16a34a' },
  failed: { label: 'Fallido', color: '#ef4444' },
  skipped: { label: 'Omitido', color: '#94a3b8' },
}

const REASON_LABELS: Record<string, string> = {
  price: 'Precios altos',
  quality: 'Calidad bajó',
  delivery_time: 'Delivery lento/caro',
  moved: 'Cambió de zona',
  competitor: 'Otro local',
  no_occasion: 'Sin ocasión',
  other: 'Otro motivo',
}

export default function RecuperacionSection({ restaurantId }: { restaurantId: string; allBranches?: { id: string }[] }) {
  const [data, setData] = useState<RecoveryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/panel/ecommerce/recovery?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [restaurantId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--ink-3)', gap: 8, fontFamily: F, fontSize: '0.84rem' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Cargando...
    </div>
  )

  if (!data) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: F }}>
      No se pudo cargar la información de recuperación.
    </div>
  )

  const k = data.kpis
  const hasData = k.contacted > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <KPI label="En riesgo" value={k.atRisk + k.churned} sub={`${k.atRiskWithEmail + k.churnedWithEmail} con email`} color="#f59e0b" />
        <KPI label="Contactados" value={k.contacted} sub={`${k.opened} abrieron`} color="#3b82f6" />
        <KPI label="Recuperados" value={k.recovered} sub={k.recoveryRate > 0 ? `${k.recoveryRate}% tasa` : 'Sin datos'} color="#16a34a" />
        <KPI label="Ingresos recuperados" value={clp(k.recoveredRevenue)} sub={`${k.recovered} pedidos`} color="#8b5cf6" isMoney />
      </div>

      {/* Por automatización */}
      {hasData && (
        <div>
          <SectionLabel>Por automatización</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {Object.entries(data.byAutomation).map(([key, v]) => (
              <div key={key} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }}>
                <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                  {AUTOMATION_LABELS[key] || key}
                </div>
                <div style={{ display: 'flex', gap: 16, fontFamily: F, fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--ink-2)' }}>Enviados <b style={{ color: 'var(--ink)' }}>{v.sent}</b></span>
                  <span style={{ color: 'var(--ink-2)' }}>Abiertos <b style={{ color: 'var(--ink)' }}>{v.opened}</b></span>
                  <span style={{ color: '#16a34a' }}>Recuperados <b>{v.converted}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Razones de abandono */}
      {Object.keys(data.reasons).length > 0 && (
        <div>
          <SectionLabel>Motivos de abandono</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(data.reasons)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, count]) => {
                const total = Object.values(data.reasons).reduce((s, v) => s + v, 0)
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: F, fontSize: '0.82rem', color: 'var(--ink)', minWidth: 140 }}>{REASON_LABELS[reason] || reason}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sunk)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: '#f59e0b' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-2)', minWidth: 32, textAlign: 'right' }}>{count}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Clientes en riesgo */}
      <div>
        <SectionLabel>Clientes en riesgo ({data.atRiskClients.length})</SectionLabel>
        {data.atRiskClients.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem' }}>
            No hay clientes en riesgo con email registrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F, fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)' }}>
                  <th style={th}>Cliente</th>
                  <th style={th}>Pedidos</th>
                  <th style={th}>Ticket</th>
                  <th style={th}>Último pedido</th>
                  <th style={th}>Frecuencia</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskClients.map((c) => (
                  <tr key={c.email} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{c.name || c.email}</div>
                      {c.name && <div style={{ fontSize: '0.74rem', color: 'var(--ink-3)' }}>{c.email}</div>}
                    </td>
                    <td style={{ ...td, fontFamily: 'var(--mono)', fontWeight: 700 }}>{c.orders}</td>
                    <td style={{ ...td, fontFamily: 'var(--mono)' }}>{clp(c.avgTicket)}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, color: c.daysSinceLastOrder > 60 ? '#ef4444' : c.daysSinceLastOrder > 30 ? '#f59e0b' : 'var(--ink)' }}>
                        {c.daysSinceLastOrder}d
                      </span>
                    </td>
                    <td style={td}>{c.avgFrequencyDays ? `c/${c.avgFrequencyDays}d` : '—'}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                        background: c.status === 'churned' ? '#fef2f2' : '#fffbeb',
                        color: c.status === 'churned' ? '#dc2626' : '#d97706',
                      }}>
                        {c.status === 'churned' ? 'Inactivo' : 'En riesgo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actividad reciente */}
      {data.recent.length > 0 && (
        <div>
          <SectionLabel>Actividad reciente</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.recent.map((r, i) => {
              const st = STATUS_LABELS[r.status] || { label: r.status, color: '#94a3b8' }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: st.color + '18', color: st.color, textTransform: 'uppercase', letterSpacing: '.03em', flexShrink: 0 }}>
                    {st.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>{r.customerName || r.customerEmail}</span>
                    <span style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-3)', marginLeft: 6 }}>{AUTOMATION_LABELS[r.automation] || r.automation}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--ink-3)', flexShrink: 0 }}>
                    {new Date(r.sentAt || r.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!hasData && data.atRiskClients.length === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
          <h3 style={{ fontFamily: F, fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px' }}>Recuperación Inteligente</h3>
          <p style={{ fontFamily: F, fontSize: '0.88rem', color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
            Cuando se active, QuieroComer detectará automáticamente clientes que dejan de comprar,
            les enviará comunicaciones personalizadas y te mostrará los resultados aquí.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

function KPI({ label, value, sub, color, isMoney }: { label: string; value: number | string; sub: string; color: string; isMoney?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: isMoney ? 'var(--mono)' : 'var(--sans)', fontSize: isMoney ? '1.2rem' : '1.5rem', fontWeight: 900, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: '0.72rem', color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: 8 }}>
      {children}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 700, color: 'var(--ink-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 10px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }
