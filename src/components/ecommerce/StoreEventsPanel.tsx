'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────
interface Interpretation { type: 'success' | 'warning' | 'insight' | 'info'; title: string; body: string; metric?: string }
interface DishRow { dishId: string; dishName: string; views: number; avgDwellMs: number | null; cartAdds: number; modifierOpens: number; addedToCartViews: number; convRate: number }
interface CatRow { categoryId: string; categoryName: string; scrolls: number; avgDwellMs: number | null }
interface CouponFailed { code: string; count: number; reason: string }
interface SearchRow { query: string; count: number }
interface AbandonedCart { cartItems: any[]; totalValue: number; createdAt: string }
interface RecentEvent { id: string; eventType: string; metadata: any; createdAt: string; guestId: string | null }
interface ReportData {
  eventCounts: Record<string, number>
  funnel: { storeViews: number; dishViews: number; cartAdds: number; checkoutStarts: number; ordersPlaced: number; browseRate: number; addRate: number; checkoutRate: number; orderRate: number; overallConversion: number }
  dishes: DishRow[]
  categories: CatRow[]
  sessions: { total: number; avgDurationMs: number | null; avgDishesViewed: number | null; withCart: number; avgCartValue: number | null }
  coupons: { total: number; successes: number; failures: number; successRate: number; topFailed: CouponFailed[] }
  searches: SearchRow[]
  abandonedCarts: AbandonedCart[]
  cartViews: { total: number; avgCartValue: number | null }
  interpretations: Interpretation[]
  recentEvents: RecentEvent[]
}

interface Props {
  restaurantId: string
  fromDate: string
  toDate: string
}

// ── Design constants ───────────────────────────────────────────────────
const F = 'var(--sans)'
const GREEN = '#16a34a'
const BLUE = '#3b82f6'
const PURPLE = '#7c3aed'
const AMBER = 'var(--amber)'
const RED = '#ef4444'

// ── Helpers ────────────────────────────────────────────────────────────
function fmtMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
function fmtDateTime(iso: string): string {
  try { return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso)) }
  catch { return iso }
}
function clpShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

const TABS = ['Interpretaciones', 'Embudo', 'Por plato', 'Categorías', 'Sesiones', 'Cupones', 'Búsquedas', 'Eventos'] as const
type TabName = typeof TABS[number]

// ── Sub-components ─────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 16px', ...style }}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderTop: `3px solid ${color}`, minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', fontFamily: F, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: '1.2rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function InterpretationsTab({ data }: { data: ReportData }) {
  const colorMap: Record<string, string> = { success: GREEN, warning: '#d97706', insight: BLUE, info: '#6b7280' }
  const iconMap: Record<string, string> = { success: '✓', warning: '⚠', insight: '💡', info: 'ℹ' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.interpretations.length === 0 ? (
        <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', fontSize: '0.84rem', textAlign: 'center', margin: '16px 0' }}>Sin datos suficientes para generar interpretaciones.</p></Card>
      ) : (
        data.interpretations.map((interp, i) => {
          const color = colorMap[interp.type] ?? '#6b7280'
          return (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderLeft: `4px solid ${color}`, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>{iconMap[interp.type]}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: F, fontWeight: 800, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: 4 }}>{interp.title}</div>
                <div style={{ fontFamily: F, fontSize: '0.82rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{interp.body}</div>
              </div>
            </div>
          )
        })
      )}

      {/* Event counts grid */}
      <Card style={{ marginTop: 4 }}>
        <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 10 }}>Conteo de eventos</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(data.eventCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: F, fontSize: '0.73rem', fontWeight: 700, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', color: 'var(--ink-2)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
              {type.replace('STORE_', '')}
              <span style={{ color: 'var(--ink)', fontWeight: 900 }}>{count}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}

function FunnelTab({ data }: { data: ReportData }) {
  const f = data.funnel
  const steps = [
    { label: 'Visitas al store', count: f.storeViews, color: BLUE, rate: null },
    { label: 'Vistas de platos', count: f.dishViews, color: PURPLE, rate: f.browseRate },
    { label: 'Agrega al carrito', count: f.cartAdds, color: '#0ea5e9', rate: f.addRate },
    { label: 'Inicio de checkout', count: f.checkoutStarts, color: AMBER, rate: f.checkoutRate },
    { label: 'Pedido completado', count: f.ordersPlaced, color: GREEN, rate: f.orderRate },
  ]
  const max = Math.max(1, f.storeViews)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Overall conversion highlight */}
      <div style={{ background: f.overallConversion >= 5 ? '#dcfce7' : f.overallConversion >= 2 ? '#fef9c3' : '#fee2e2', border: `1px solid ${f.overallConversion >= 5 ? '#bbf7d0' : f.overallConversion >= 2 ? '#fef08a' : '#fecaca'}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 }}>Conversión total (visita → pedido)</div>
          <div style={{ fontFamily: F, fontSize: '2rem', fontWeight: 900, color: f.overallConversion >= 5 ? GREEN : f.overallConversion >= 2 ? '#854d0e' : RED, lineHeight: 1 }}>{f.overallConversion}%</div>
        </div>
        <div style={{ fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-3)', textAlign: 'right' as const }}>
          {f.storeViews} visitas<br/>{f.ordersPlaced} pedidos
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((step, i) => {
            const pct = Math.round((step.count / max) * 100)
            return (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)' }}>{step.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {step.rate !== null && <span style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)' }}>{step.rate}% del paso anterior →</span>}
                    <span style={{ fontFamily: F, fontSize: '0.9rem', fontWeight: 900, color: step.color }}>{step.count.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <div style={{ height: 10, background: 'var(--sunk)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: step.color, borderRadius: 999, transition: 'width .3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

type DishSortKey = 'views' | 'avgDwellMs' | 'cartAdds' | 'modifierOpens' | 'convRate'

function DishesTab({ data }: { data: ReportData }) {
  const [sortKey, setSortKey] = useState<DishSortKey>('views')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...data.dishes].sort((a, b) => {
    let diff = 0
    if (sortKey === 'views') diff = a.views - b.views
    else if (sortKey === 'avgDwellMs') diff = (a.avgDwellMs ?? 0) - (b.avgDwellMs ?? 0)
    else if (sortKey === 'cartAdds') diff = a.cartAdds - b.cartAdds
    else if (sortKey === 'modifierOpens') diff = a.modifierOpens - b.modifierOpens
    else diff = a.convRate - b.convRate
    return sortAsc ? diff : -diff
  })
  const toggleSort = (k: DishSortKey) => { if (sortKey === k) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(false) } }

  const thSt = (col: DishSortKey): React.CSSProperties => ({
    fontFamily: F, fontSize: '0.64rem', fontWeight: 700,
    color: sortKey === col ? 'var(--ink)' : 'var(--ink-3)',
    textTransform: 'uppercase' as const, cursor: 'pointer', userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const, padding: '0 6px 8px',
  })
  const SortArrow = ({ col }: { col: DishSortKey }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2, opacity: sortKey === col ? 1 : 0.3 }}>
      {sortAsc && sortKey === col ? <path d="M5 2L9 8H1z" fill="currentColor"/> : <path d="M5 8L1 2H9z" fill="currentColor"/>}
    </svg>
  )

  if (data.dishes.length === 0) return <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.84rem' }}>Sin datos de platos en el período.</p></Card>

  return (
    <Card>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
          <thead>
            <tr>
              <th style={{ ...thSt('views'), textAlign: 'left', paddingLeft: 0 }} onClick={() => toggleSort('views')}>Plato<SortArrow col="views"/></th>
              <th style={thSt('views')} onClick={() => toggleSort('views')}>Vistas<SortArrow col="views"/></th>
              <th style={thSt('avgDwellMs')} onClick={() => toggleSort('avgDwellMs')}>Dwell prom.<SortArrow col="avgDwellMs"/></th>
              <th style={thSt('cartAdds')} onClick={() => toggleSort('cartAdds')}>Carrito<SortArrow col="cartAdds"/></th>
              <th style={thSt('modifierOpens')} onClick={() => toggleSort('modifierOpens')}>Modif.<SortArrow col="modifierOpens"/></th>
              <th style={thSt('convRate')} onClick={() => toggleSort('convRate')}>Conv.<SortArrow col="convRate"/></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => {
              const convColor = d.convRate >= 30 ? GREEN : d.convRate >= 15 ? '#d97706' : RED
              const highDwellLowConv = (d.avgDwellMs ?? 0) > 20000 && d.convRate < 20
              const modFriction = d.modifierOpens > d.cartAdds
              return (
                <tr key={d.dishId} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--sunk)' }}>
                  <td style={{ padding: '7px 8px 7px 0', fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highDwellLowConv && <span title="Alto dwell, baja conversión" style={{ marginRight: 4 }}>🔥</span>}
                    {modFriction && <span title="Fricción en modificadores" style={{ marginRight: 4 }}>⚠</span>}
                    {d.dishName || d.dishId}
                  </td>
                  <td style={{ padding: '7px 6px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)', textAlign: 'right' as const, whiteSpace: 'nowrap' }}>{d.views}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.82rem', color: 'var(--ink-2)', textAlign: 'right' as const, whiteSpace: 'nowrap' }}>{fmtMs(d.avgDwellMs)}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)', textAlign: 'right' as const }}>{d.cartAdds}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.82rem', color: 'var(--ink-2)', textAlign: 'right' as const }}>{d.modifierOpens}</td>
                  <td style={{ padding: '7px 6px', fontSize: '0.84rem', fontWeight: 900, color: convColor, textAlign: 'right' as const, whiteSpace: 'nowrap' }}>{d.convRate}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CategoriesTab({ data }: { data: ReportData }) {
  if (data.categories.length === 0) return <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.84rem' }}>Sin datos de categorías en el período.</p></Card>
  const maxScrolls = Math.max(1, ...data.categories.map(c => c.scrolls))
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.categories.map((c, i) => (
          <div key={c.categoryId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 8 }}>
              <span style={{ fontFamily: F, fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', marginRight: 6 }}>{i + 1}.</span>
                {c.categoryName || c.categoryId}
              </span>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 900, color: 'var(--ink)' }}>{c.scrolls} scrolls</span>
                {c.avgDwellMs !== null && <span style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)' }}>{fmtMs(c.avgDwellMs)}</span>}
              </div>
            </div>
            <div style={{ height: 7, background: 'var(--sunk)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((c.scrolls / maxScrolls) * 100)}%`, height: '100%', background: PURPLE, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function SessionsTab({ data }: { data: ReportData }) {
  const s = data.sessions
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <KpiCard label="Total sesiones" value={s.total.toString()} color={BLUE} />
        <KpiCard label="Duración prom." value={fmtMs(s.avgDurationMs)} hint="por sesión" color={PURPLE} />
        <KpiCard label="Platos vistos prom." value={s.avgDishesViewed != null ? s.avgDishesViewed.toString() : '—'} color={GREEN} />
        <KpiCard label="Sesiones con carrito" value={s.withCart.toString()} hint="finalizaron con ítem en carrito" color={AMBER} />
        <KpiCard label="Valor prom. carrito aband." value={s.avgCartValue != null ? clpShort(s.avgCartValue) : '—'} color={RED} />
      </div>

      {data.abandonedCarts.length > 0 && (
        <Card>
          <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 12 }}>Últimos carritos abandonados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.abandonedCarts.slice(0, 10).map((cart, i) => (
              <div key={i} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)' }}>{fmtDateTime(cart.createdAt)}</span>
                  <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 900, color: 'var(--ink)' }}>{clpShort(cart.totalValue)}</span>
                </div>
                {cart.cartItems.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {cart.cartItems.map((item: any, j: number) => (
                      <span key={j} style={{ fontFamily: F, fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px', color: 'var(--ink-2)' }}>
                        {item.qty || item.quantity || 1}× {item.name || item.dishName || '?'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function CouponsTab({ data }: { data: ReportData }) {
  const c = data.coupons
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        <KpiCard label="Total intentos" value={c.total.toString()} color={BLUE} />
        <KpiCard label="Exitosos" value={c.successes.toString()} color={GREEN} />
        <KpiCard label="Fallidos" value={c.failures.toString()} color={RED} />
        <KpiCard label="Tasa de éxito" value={`${c.successRate}%`} color={c.successRate >= 50 ? GREEN : AMBER} />
      </div>

      {c.topFailed.length > 0 && (
        <Card>
          <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 12 }}>Cupones fallidos más usados</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
              <thead>
                <tr>
                  {['Código', 'Intentos', 'Motivo'].map(h => (
                    <th key={h} style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' as const, padding: '0 6px 8px', textAlign: 'left' as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.topFailed.map((row, i) => (
                  <tr key={row.code} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--sunk)' }}>
                    <td style={{ padding: '7px 6px', fontFamily: F, fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)' }}>{row.code}</td>
                    <td style={{ padding: '7px 6px', fontFamily: F, fontSize: '0.84rem', fontWeight: 900, color: RED, textAlign: 'center' as const }}>{row.count}</td>
                    <td style={{ padding: '7px 6px', fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-3)' }}>{row.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function SearchesTab({ data }: { data: ReportData }) {
  if (data.searches.length === 0) return (
    <Card>
      <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.84rem' }}>Sin búsquedas en el período.</p>
    </Card>
  )
  const max = Math.max(1, data.searches[0]?.count ?? 1)
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>Búsquedas realizadas</div>
        <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)' }}>Búsquedas sin resultado — oportunidades de menú</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.searches.map((s, i) => (
          <div key={s.query}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: F, fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>
                <span style={{ color: 'var(--ink-3)', marginRight: 6, fontSize: '0.72rem' }}>{i + 1}.</span>
                {s.query}
              </span>
              <span style={{ fontFamily: F, fontSize: '0.84rem', fontWeight: 900, color: 'var(--ink)' }}>{s.count}×</span>
            </div>
            <div style={{ height: 5, background: 'var(--sunk)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((s.count / max) * 100)}%`, height: '100%', background: BLUE, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

const EVENT_COLORS: Record<string, string> = {
  STORE_VIEW: '#16a34a',
  STORE_DISH_VIEW: '#059669',
  STORE_CART_ADD: '#0d9488',
  STORE_CART_REMOVE: '#ef4444',
  STORE_CHECKOUT_START: '#3b82f6',
  STORE_CHECKOUT_ABANDON: '#f97316',
  STORE_ORDER_PLACED: '#7c3aed',
  STORE_SEARCH: '#6366f1',
  STORE_CART_VIEW: '#0ea5e9',
  STORE_SESSION_END: '#64748b',
  STORE_SCROLL_CATEGORY: '#8b5cf6',
  STORE_COUPON_ATTEMPT: '#d97706',
  STORE_MODIFIER_OPEN: '#ec4899',
}

function EventsTab({ data }: { data: ReportData }) {
  const [filter, setFilter] = useState<string>('ALL')
  const eventTypes = ['ALL', ...Array.from(new Set(data.recentEvents.map(e => e.eventType)))]
  const filtered = filter === 'ALL' ? data.recentEvents : data.recentEvents.filter(e => e.eventType === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {eventTypes.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 700, padding: '5px 10px', borderRadius: 999, border: '1px solid var(--line)', background: filter === t ? 'var(--ink)' : 'var(--surface)', color: filter === t ? 'var(--surface)' : 'var(--ink-3)', cursor: 'pointer', transition: 'all .15s' }}>
            {t === 'ALL' ? 'Todos' : t.replace('STORE_', '')}
          </button>
        ))}
      </div>

      <Card style={{ padding: '12px 0' }}>
        {filtered.length === 0 ? (
          <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.84rem' }}>Sin eventos para este filtro.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((e, i) => {
              const color = EVENT_COLORS[e.eventType] ?? '#64748b'
              const shortGuest = e.guestId ? `...${e.guestId.slice(-6)}` : '—'
              const metaStr = e.metadata ? JSON.stringify(e.metadata, null, 0).slice(0, 120) : '—'
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0 10px', padding: '8px 16px', background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', alignItems: 'start' }}>
                  <span style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 800, background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' as const, alignSelf: 'center' }}>
                    {e.eventType.replace('STORE_', '')}
                  </span>
                  <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: '0.72rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{metaStr}</span>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    <div style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' as const }}>{fmtDateTime(e.createdAt)}</div>
                    <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: '0.65rem', color: 'var(--ink-4, var(--ink-3))', opacity: 0.7 }}>{shortGuest}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────
export default function StoreEventsPanel({ restaurantId, fromDate, toDate }: Props) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabName>('Interpretaciones')

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true); setError(false)
    try {
      const res = await fetch(`/api/panel/ecommerce/store-events/report?restaurantId=${restaurantId}&from=${fromDate}&to=${toDate}`)
      if (!res.ok) throw new Error('error')
      const json = await res.json()
      setData(json)
    } catch { setError(true) }
    setLoading(false)
  }, [restaurantId, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const tabPillBase: React.CSSProperties = {
    fontFamily: F, fontSize: '0.76rem', fontWeight: 700,
    padding: '6px 12px', borderRadius: 999, border: '1px solid var(--line)',
    cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap' as const,
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ ...tabPillBase, background: activeTab === tab ? 'var(--ink)' : 'var(--surface)', color: activeTab === tab ? 'var(--surface)' : 'var(--ink-3)', borderColor: activeTab === tab ? 'var(--ink)' : 'var(--line)' }}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Cargando…
        </div>
      ) : error ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '32px 24px', textAlign: 'center' as const }}>
          <p style={{ fontFamily: F, color: 'var(--ink-3)', fontSize: '0.84rem', margin: 0 }}>No se pudo cargar el reporte de eventos.</p>
          <button onClick={load} style={{ marginTop: 12, fontFamily: F, fontSize: '0.8rem', fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink-2)' }}>Reintentar</button>
        </div>
      ) : !data ? null : (
        <>
          {activeTab === 'Interpretaciones' && <InterpretationsTab data={data} />}
          {activeTab === 'Embudo' && <FunnelTab data={data} />}
          {activeTab === 'Por plato' && <DishesTab data={data} />}
          {activeTab === 'Categorías' && <CategoriesTab data={data} />}
          {activeTab === 'Sesiones' && <SessionsTab data={data} />}
          {activeTab === 'Cupones' && <CouponsTab data={data} />}
          {activeTab === 'Búsquedas' && <SearchesTab data={data} />}
          {activeTab === 'Eventos' && <EventsTab data={data} />}
        </>
      )}
    </div>
  )
}
