'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import DelifastTracking from '../DelifastTracking'
import StoreEventsPanel from '@/components/ecommerce/StoreEventsPanel'

const DeliveryHeatmap = dynamic(() => import('../DeliveryHeatmap'), { ssr: false, loading: () => <div style={{ height: 340, borderRadius: 14, background: 'var(--sunk)', border: '1px solid var(--line)' }} /> })

// ── Helpers ─────────────────────────────────────────────────────────
const clp = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
function clpShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}
function chileTodayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function weekdayShort(month: string, day: number): string {
  try {
    const d = new Date(`${month}-${String(day).padStart(2, '0')}T12:00:00`)
    const w = new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(d).replace('.', '')
    return w.charAt(0).toUpperCase() + w.slice(1)
  } catch { return '' }
}

const F = 'var(--sans)'
const GREEN = '#16a34a'
const BLUE = '#3b82f6'
const PURPLE = '#7c3aed'

interface HourBucket  { hour: number; sales: number; orders: number }
interface Channel     { name: string; sales: number; orders: number }
interface ProductRank { name: string; qty: number; revenue: number }
interface TypeBucket  { type: string; label: string; sales: number; orders: number }
interface MonthlyDay  { day: number; sales: number; orders: number }
interface DeliveryTimeRow {
  orderId: string; ref: string; name: string; phone: string; addressLine: string;
  totalAmount: number; paidAmount: number; deliveryFee: number; tipAmount: number; vendorName: string;
  createdAt: string; readyAt: string | null; dispatchedAt: string | null; deliveredAt: string | null;
  prepMin: number | null; transitMin: number | null; totalMin: number | null;
  items: unknown; delifastVentaId: string | null;
}
interface DeliveryTimes {
  count: number
  avgTotal: number | null; avgPrep: number | null; avgTransit: number | null
  pctUnder30: number | null; pctUnder45: number | null; pctUnder60: number | null
  orders: DeliveryTimeRow[]
}
interface PaymentMethod { method: string; label: string; count: number; amount: number }
interface CancellationData { count: number; rate: number; reasons: { reason: string; count: number }[] }
interface TipsStats { total: number; avgPerOrder: number; pctWithTip: number }
interface Report {
  ordersCount: number
  productSales: number
  deliveryTotal: number
  tipsTotal: number
  grossTotal: number
  hourly: HourBucket[]
  dowStats?: DowStat[]
  channels: Channel[]
  products: ProductRank[]
  byType: TypeBucket[]
  monthly: { month: string; days: MonthlyDay[] }
  byMonth?: { ym: string; sales: number; orders: number }[]
  byYear?: { yr: string; sales: number; orders: number }[]
  deliveryTimes?: DeliveryTimes
  paymentMethods?: PaymentMethod[]
  cancellations?: CancellationData
  tipsStats?: TipsStats
}

// ── Design primitives ─────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 16px', ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, marginTop: 24 }}>
      {children}
    </div>
  )
}

function Stat({ label, value, hint, color, big, span }: { label: string; value: string; hint?: string; color: string; big?: boolean; span?: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderTop: `3px solid ${color}`, overflow: 'hidden', minWidth: 0, gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', fontFamily: F, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: big ? '1.35rem' : '1.2rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{value}</div>
      {hint && <div style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function MonthlyChart({ monthly }: { monthly: { month: string; days: MonthlyDay[] } }) {
  const days = monthly?.days ?? []
  const hasData = days.some(d => d.sales > 0)
  const max = Math.max(1, ...days.map(d => d.sales))
  const totalSales = days.reduce((s, d) => s + d.sales, 0)
  const totalOrders = days.reduce((s, d) => s + d.orders, 0)
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0
  const monthName = (() => {
    try { return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(`${monthly?.month}-15T12:00:00Z`)) }
    catch { return monthly?.month ?? '' }
  })()

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>Mes · {monthName}</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>con IVA</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-2)' }}>Total: <strong>{clp(totalSales)}</strong></span>
        <span style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-2)' }}>Pedidos: <strong>{totalOrders.toLocaleString('es-CL')}</strong></span>
        <span style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-2)' }}>Ticket prom.: <strong>{clp(avgTicket)}</strong></span>
      </div>
      {!hasData ? (
        <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.82rem' }}>Aún no hay ventas este mes.</p>
      ) : (
        <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto', overflowY: 'hidden', paddingTop: 20, paddingBottom: 4 }}>
          {days.map(d => {
            const pct = d.sales > 0 ? Math.max(4, Math.round((d.sales / max) * 100)) : 0
            const ticket = d.orders > 0 ? d.sales / d.orders : 0
            return (
              <div key={d.day} style={{ flex: '1 0 40px', minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '68%', maxWidth: 26, height: `${pct}%`, background: `linear-gradient(180deg,${GREEN},${GREEN}bb)`, borderRadius: '4px 4px 0 0', minHeight: d.sales > 0 ? 3 : 0, transition: 'height .3s' }}>
                    {d.sales > 0 && (
                      <span style={{ position: 'absolute', bottom: '100%', marginBottom: 2, left: '50%', transform: 'translateX(-50%)', fontFamily: F, fontSize: '0.56rem', fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{clpShort(d.sales)}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-2)', marginTop: 4, whiteSpace: 'nowrap' }}>{weekdayShort(monthly.month, d.day)} {d.day}</span>
                {d.sales > 0 ? (
                  <>
                    <span style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{d.orders}p</span>
                    <span style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>⌀{clpShort(ticket)}</span>
                  </>
                ) : (
                  <span style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-3)' }}>—</span>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 32, background: 'linear-gradient(to right, transparent, var(--surface))', pointerEvents: 'none', borderRadius: '0 12px 12px 0' }} />
        </div>
      )}
    </Card>
  )
}

function HourlyChart({ hourly }: { hourly: HourBucket[] }) {
  const active = hourly.filter(h => h.sales > 0 || h.orders > 0)
  const hasData = active.length > 0
  const minH = hasData ? Math.max(0, Math.min(...active.map(h => h.hour)) - 1) : 0
  const maxH = hasData ? Math.min(23, Math.max(...active.map(h => h.hour)) + 1) : 23
  const range = hourly.slice(minH, maxH + 1)
  const max = Math.max(1, ...range.map(h => h.sales))

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Por hora</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>con IVA</span>
      </div>
      {!hasData ? (
        <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.82rem' }}>Sin ventas en el período.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, overflowX: 'auto', overflowY: 'hidden', paddingTop: 20 }}>
          {range.map(h => {
            const pct = h.sales > 0 ? Math.max(3, Math.round((h.sales / max) * 100)) : 0
            return (
              <div key={h.hour} style={{ flex: '1 0 32px', minWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }} title={`${h.hour.toString().padStart(2,'0')}h · ${clp(h.sales)} · ${h.orders} pedidos`}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '75%', maxWidth: 32, height: `${pct}%`, background: `linear-gradient(180deg,var(--amber),var(--amber-press))`, borderRadius: '4px 4px 0 0', minHeight: h.sales > 0 ? 4 : 0, transition: 'height .3s' }}>
                    {h.sales > 0 && (
                      <span style={{ position: 'absolute', bottom: '100%', marginBottom: 2, left: '50%', transform: 'translateX(-50%)', fontFamily: F, fontSize: '0.58rem', fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{clpShort(h.sales)}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 4 }}>{h.hour.toString().padStart(2,'0')}h</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function ChannelBreakdown({ channels, total }: { channels: Channel[]; total: number }) {
  const palette = ['var(--amber)', GREEN, BLUE, PURPLE, '#ef4444', '#0ea5e9', '#ec4899']
  return (
    <Card style={{ flex: '2 1 240px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Por canal</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>con IVA</span>
      </div>
      {channels.length === 0 ? (
        <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>Sin ventas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {channels.map((c, i) => {
            const pct = total > 0 ? Math.round((c.sales / total) * 100) : 0
            const color = palette[i % palette.length]
            return (
              <div key={c.name}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, fontFamily: F, fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                    {c.name}
                    <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', fontWeight: 500 }}>· {c.orders} ped.</span>
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: F, fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)' }}>{clp(c.sales)} <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 500, color: 'var(--ink-3)' }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function OrderTypePie({ byType }: { byType: TypeBucket[] }) {
  const slices = (byType ?? []).filter(t => t.sales > 0)
  const total = slices.reduce((s, t) => s + t.sales, 0)
  const colors: Record<string, string> = { delivery: BLUE, pickup: GREEN, 'dine-in': PURPLE }
  const r = 42, cx = 50, cy = 50, C = 2 * Math.PI * r
  let acc = 0
  return (
    <Card style={{ flex: '1 1 180px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Por tipo</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>con IVA</span>
      </div>
      {total === 0 ? (
        <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>Sin ventas.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <svg viewBox="0 0 100 100" width={90} height={90} style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={16} />
            {slices.map(t => {
              const frac = t.sales / total
              const dash = frac * C
              const el = <circle key={t.type} cx={cx} cy={cy} r={r} fill="none" stroke={colors[t.type] || 'var(--amber)'} strokeWidth={16} strokeLinecap="butt" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />
              acc += frac
              return el
            })}
          </svg>
          <div style={{ flex: 1, minWidth: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slices.map(t => {
              const pct = Math.round((t.sales / total) * 100)
              return (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[t.type] || 'var(--amber)', flexShrink: 0 }} />
                    {t.label}
                  </span>
                  <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 800, color: 'var(--ink)', flexShrink: 0 }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

type ProductSortKey = 'qty' | 'revenue' | 'name'
function ProductRanking({ products }: { products: ProductRank[] }) {
  const [sortKey, setSortKey] = useState<ProductSortKey>('qty')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...products].sort((a, b) => {
    let diff = 0
    if (sortKey === 'qty') diff = a.qty - b.qty
    else if (sortKey === 'revenue') diff = a.revenue - b.revenue
    else diff = a.name.localeCompare(b.name, 'es')
    return sortAsc ? diff : -diff
  })

  const toggleSort = (key: ProductSortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortArrow = ({ col }: { col: ProductSortKey }) => {
    const active = sortKey === col
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 3, opacity: active ? 1 : 0.3 }}>
        {sortAsc && active
          ? <path d="M5 2L9 8H1z" fill="currentColor"/>
          : <path d="M5 8L1 2H9z" fill="currentColor"/>}
      </svg>
    )
  }

  const thSt = (col: ProductSortKey): React.CSSProperties => ({
    fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: sortKey === col ? 'var(--ink)' : 'var(--ink-3)',
    textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  })

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Productos más vendidos</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{products.length} productos</span>
      </div>
      {products.length === 0 ? (
        <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>Sin ventas en el período.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0 8px 8px 0' }} onClick={() => toggleSort('name')}>
                  <span style={{ ...thSt('name'), display: 'inline-flex', alignItems: 'center' }}>Producto <SortArrow col="name" /></span>
                </th>
                <th style={{ textAlign: 'right', padding: '0 0 8px 8px', width: 60 }} onClick={() => toggleSort('qty')}>
                  <span style={{ ...thSt('qty'), display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>Cant. <SortArrow col="qty" /></span>
                </th>
                <th style={{ textAlign: 'right', padding: '0 0 8px 16px', width: 90 }} onClick={() => toggleSort('revenue')}>
                  <span style={{ ...thSt('revenue'), display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>Venta <SortArrow col="revenue" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--sunk)' }}>
                  <td style={{ padding: '7px 8px 7px 0', fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: i < 3 ? 'var(--amber-tint)' : 'var(--sunk)', color: i < 3 ? 'var(--amber)' : 'var(--ink-3)', fontSize: '0.65rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      {p.name}
                    </span>
                  </td>
                  <td style={{ padding: '7px 0 7px 8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.qty} u.</td>
                  <td style={{ padding: '7px 0 7px 16px', fontSize: '0.84rem', fontWeight: 800, color: p.revenue > 0 ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.revenue > 0 ? clp(p.revenue) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function minLabel(m: number | null): string {
  if (m == null) return '—'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}min`
}

function timeColor(m: number): string {
  if (m <= 30) return GREEN
  if (m <= 45) return BLUE
  if (m <= 60) return 'var(--amber)'
  return '#ef4444'
}

// ── Helpers de formato ───────────────────────────────────────────
function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso))
}
function diffMin(a: string | null, b: string | null): string {
  if (!a || !b) return '—'
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  if (d < 0) return '—'
  return d < 60 ? `${d} min` : `${Math.floor(d / 60)}h ${d % 60}min`
}

// ── Modal detalle de pedido delivery ─────────────────────────────
function DeliveryOrderModal({ order, restaurantId, onClose }: { order: DeliveryTimeRow; restaurantId: string; onClose: () => void }) {
  const clpF = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
  const items = Array.isArray(order.items) ? order.items as Record<string, any>[] : []
  const lines = items.filter(it => it && typeof it === 'object' && !it.isExtra && it.referenceLine == null)

  const timelineSteps = [
    { label: 'Pedido recibido', ts: order.createdAt, color: '#64748b' },
    { label: 'Listo para despacho', ts: order.readyAt, color: '#16a34a' },
    { label: 'En reparto', ts: order.dispatchedAt, color: '#3b82f6' },
    { label: 'Entregado', ts: order.deliveredAt, color: '#7c3aed' },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' }}
      className="delivery-modal-backdrop"
      onClick={onClose}
    >
      <style>{`
        @media (min-width: 600px) {
          .delivery-modal-backdrop { align-items: center !important; padding: 24px !important; }
          .delivery-modal-sheet { border-radius: 20px !important; max-height: 88dvh !important; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        className="delivery-modal-sheet"
        style={{
          width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto',
          background: 'var(--surface)', borderRadius: '20px 20px 0 0',
          padding: '20px 20px 32px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: F, fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
              {order.ref ? `#${order.ref}` : 'Pedido'} · {order.name || 'Cliente'}
            </div>
            <div style={{ fontFamily: F, fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
              {fmtDateTime(order.createdAt)}{order.vendorName ? ` · ${order.vendorName}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, lineHeight: 0, flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Info cliente */}
        <div style={{ background: 'var(--sunk)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.addressLine && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--ink-3)', flexShrink: 0, marginTop: 1 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
              <span style={{ fontFamily: F, fontSize: 13.5, color: 'var(--ink-2)' }}>{order.addressLine}</span>
            </div>
          )}
          {order.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--ink-3)', flexShrink: 0 }}><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 11 11 0 0 0 .56 3.5 1 1 0 0 1-.25 1z"/></svg>
              <a href={`tel:${order.phone}`} style={{ fontFamily: F, fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none' }}>{order.phone}</a>
            </div>
          )}
        </div>

        {/* Montos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Total', value: clpF(order.totalAmount) },
            { label: 'Delivery', value: clpF(order.deliveryFee) },
            { label: 'Propina', value: clpF(order.tipAmount) },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Ítems */}
        {lines.length > 0 && (
          <div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Productos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {lines.map((it, i) => {
                const name = String(it.productName ?? it.name ?? it.dishName ?? it.title ?? '').trim()
                const qty = Number(it.quantity ?? it.qty ?? 1)
                const price = Number(it.amountAfterTax ?? it.unitPriceAfterTax ?? it.unitPrice ?? it.price ?? 0)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontFamily: F, fontWeight: 700, fontSize: 13, color: 'var(--ink-3)', minWidth: 20 }}>{qty}×</span>
                    <span style={{ fontFamily: F, fontSize: 13.5, color: 'var(--ink)', flex: 1 }}>{name || '—'}</span>
                    {price > 0 && <span style={{ fontFamily: F, fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }}>{clpF(price)}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Timeline de etapas */}
        <div>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {timelineSteps.map((step, i) => {
              const done = !!step.ts
              const isLast = i === timelineSteps.length - 1
              const nextTs = timelineSteps[i + 1]?.ts ?? null
              const dur = done && nextTs ? diffMin(step.ts, nextTs) : null
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: done ? step.color : 'var(--line-strong)', flexShrink: 0, marginTop: 4 }} />
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 24, background: done && nextTs ? step.color + '40' : 'var(--line)', marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: done ? 700 : 400, color: done ? 'var(--ink)' : 'var(--ink-4)' }}>{step.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: done ? 'var(--ink-2)' : 'var(--ink-4)', flexShrink: 0 }}>{fmtTime(step.ts)}</span>
                    </div>
                    {dur && <div style={{ fontFamily: F, fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>↓ {dur} hasta siguiente etapa</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tiempos resumen */}
        {(order.prepMin != null || order.transitMin != null || order.totalMin != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Preparación', value: order.prepMin != null ? minLabel(order.prepMin) : '—', color: BLUE },
              { label: 'Tránsito', value: order.transitMin != null ? minLabel(order.transitMin) : '—', color: PURPLE },
              { label: 'Total', value: order.totalMin != null ? minLabel(order.totalMin) : '—', color: order.totalMin != null ? timeColor(order.totalMin) : 'var(--ink-3)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Delifast tracking (historial, sin live poll) */}
        {order.delifastVentaId && (
          <div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Delifast</div>
            <DelifastTracking restaurantId={restaurantId} posOrderId={order.orderId} live={false} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Gráfico de costo delivery por día ──────────────────────────────
function DeliveryCostChart({ orders, selectedDate, onDateClick }: {
  orders: DeliveryTimeRow[]; selectedDate: string | null; onDateClick: (date: string) => void
}) {
  const byDay = new Map<string, number>()
  for (const o of orders) {
    if (!o.createdAt || !o.deliveryFee) continue
    const day = o.createdAt.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + o.deliveryFee)
  }
  const days = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  if (days.length < 2) return null
  const maxFee = Math.max(1, ...days.map(d => d[1]))
  const totalDelivery = orders.reduce((s, o) => s + (o.deliveryFee || 0), 0)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Costo delivery por día</span>
        {totalDelivery > 0 && <span style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 800, color: 'var(--ink-2)' }}>{clp(totalDelivery)} total</span>}
      </div>
      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 700, color: BLUE }}>
            Filtrando: {new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' }).format(new Date(selectedDate + 'T12:00:00'))}
          </span>
          <button onClick={() => onDateClick('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, lineHeight: 0, fontSize: 14 }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 145, overflowX: 'auto', overflowY: 'hidden', paddingTop: 22 }}>
        {days.map(([date, fee]) => {
          const pct = Math.max(4, Math.round((fee / maxFee) * 100))
          const d = new Date(date + 'T12:00:00')
          const dayLabel = new Intl.DateTimeFormat('es-CL', { weekday: 'short', timeZone: 'America/Santiago' }).format(d)
          const dateLabel = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' }).format(d)
          const isActive = selectedDate === date
          return (
            <div key={date} onClick={() => onDateClick(isActive ? '' : date)}
              style={{ flex: '1 0 44px', minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', cursor: 'pointer' }}
              title={`${dayLabel} ${dateLabel} · ${clp(fee)}`}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{
                  position: 'relative', width: '70%', maxWidth: 32, height: `${pct}%`, minHeight: 4,
                  background: isActive ? `linear-gradient(180deg,${BLUE},${BLUE}cc)` : `linear-gradient(180deg,${BLUE}99,${BLUE}66)`,
                  borderRadius: '4px 4px 0 0',
                  outline: isActive ? `2px solid ${BLUE}` : 'none', outlineOffset: 2,
                  transition: 'background .15s',
                }}>
                  <span style={{ position: 'absolute', bottom: '100%', marginBottom: 3, left: '50%', transform: 'translateX(-50%)', fontFamily: F, fontSize: '0.56rem', fontWeight: 700, color: isActive ? BLUE : 'var(--ink-2)', whiteSpace: 'nowrap' }}>{clpShort(fee)}</span>
                </div>
              </div>
              <span style={{ fontFamily: F, fontSize: '0.62rem', color: isActive ? BLUE : 'var(--ink)', marginTop: 3, whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'capitalize' }}>{dayLabel}</span>
              <span style={{ fontFamily: F, fontSize: '0.56rem', color: isActive ? BLUE : 'var(--ink-3)', whiteSpace: 'nowrap', fontWeight: isActive ? 700 : 400 }}>{dateLabel}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Tabla de tiempos de entrega ─────────────────────────────────────
const PAGE_SIZE = 10
type SortCol = 'ref' | 'prep' | 'transit' | 'total' | 'delivery'

function DeliveryTimesSection({ dt, restaurantId, selectedDate, onDateClick }: {
  dt: DeliveryTimes; restaurantId: string; selectedDate: string | null; onDateClick: (date: string) => void
}) {
  const [selected, setSelected] = useState<DeliveryTimeRow | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Reset page whenever filter/sort changes
  useEffect(() => { setPage(0) }, [search, selectedDate, sortCol, sortDir])

  if (dt.count === 0) return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Detalle deliverys</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>Delivery</span>
      </div>
      <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>Sin entregas completadas en el período.</p>
    </Card>
  )

  // Filter + sort
  const q = search.trim().toLowerCase()
  const filtered = (() => {
    let rows = dt.orders
    if (selectedDate) rows = rows.filter(o => o.createdAt?.startsWith(selectedDate))
    if (q) rows = rows.filter(o =>
      (o.name || '').toLowerCase().includes(q) ||
      (o.ref || '').toLowerCase().includes(q)
    )
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortCol === 'ref') { va = a.ref || ''; vb = b.ref || '' }
      else if (sortCol === 'prep') { va = a.prepMin ?? 999999; vb = b.prepMin ?? 999999 }
      else if (sortCol === 'transit') { va = a.transitMin ?? 999999; vb = b.transitMin ?? 999999 }
      else if (sortCol === 'total') { va = a.totalMin ?? 999999; vb = b.totalMin ?? 999999 }
      else if (sortCol === 'delivery') { va = a.deliveryFee ?? 0; vb = b.deliveryFee ?? 0 }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  })()

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortCol }) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ opacity: sortCol === col ? 1 : 0.3, flexShrink: 0 }}>
      {sortCol === col && sortDir === 'asc'
        ? <path d="M12 5l-7 7h14zM12 19V11" />
        : sortCol === col && sortDir === 'desc'
        ? <path d="M12 19l7-7H5zM12 5v8" />
        : <path d="M12 5l-4 4h8zM12 19l-4-4h8z" />}
    </svg>
  )

  // KPIs computed from filtered rows when a date filter is active
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null
  const filteredCompleted = filtered.filter(o => o.totalMin != null)
  const kpiAvgTotal = selectedDate ? avg(filteredCompleted.map(o => o.totalMin!)) : dt.avgTotal
  const kpiAvgPrep  = selectedDate ? avg(filtered.filter(o => o.prepMin != null).map(o => o.prepMin!)) : dt.avgPrep
  const kpiAvgTransit = selectedDate ? avg(filtered.filter(o => o.transitMin != null).map(o => o.transitMin!)) : dt.avgTransit
  const kpiCostoTotal = filtered.reduce((s, o) => s + (o.deliveryFee || 0), 0)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Detalle deliverys</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>
          {dt.orders.filter((o: any) => o.totalMin != null).length} de {dt.count} entregados
        </span>
      </div>

      {/* KPI summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Promedio total', value: minLabel(kpiAvgTotal), color: kpiAvgTotal != null ? timeColor(kpiAvgTotal) : 'var(--ink-3)' },
          { label: 'Preparación', value: minLabel(kpiAvgPrep), color: BLUE },
          { label: 'En tránsito', value: minLabel(kpiAvgTransit), color: PURPLE },
          { label: 'Costo total', value: kpiCostoTotal > 0 ? clp(kpiCostoTotal) : '—', color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: F, fontSize: '1.1rem', fontWeight: 900, color: 'var(--ink)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o nro. de pedido…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', fontFamily: F, fontSize: '0.8rem', outline: 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, lineHeight: 0, fontSize: 14 }}>✕</button>
        )}
      </div>

      {/* Filtro activo de fecha */}
      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 700, color: BLUE, background: `${BLUE}18`, border: `1px solid ${BLUE}40`, borderRadius: 999, padding: '3px 10px' }}>
            {new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' }).format(new Date(selectedDate + 'T12:00:00'))}
          </span>
          <button onClick={() => onDateClick('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 0, lineHeight: 0, fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Tabla */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* header sortable */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 60px 52px 60px', gap: 8, padding: '4px 6px', marginBottom: 2 }}>
          {([['ref', 'Pedido', 'left'], ['prep', 'Prep.', 'right'], ['transit', 'Tránsito', 'right'], ['total', 'Total', 'right'], ['delivery', 'Delivery', 'right']] as [SortCol, string, string][]).map(([col, label, align]) => (
            <button key={col} onClick={() => toggleSort(col)} style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: align === 'right' ? 'flex-end' : 'flex-start', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: sortCol === col ? 'var(--ink)' : 'var(--ink-3)', textTransform: 'uppercase' }}>{label}</span>
              <SortIcon col={col} />
            </button>
          ))}
        </div>

        {pageRows.length === 0 ? (
          <div style={{ fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>Sin resultados</div>
        ) : pageRows.map((o, i) => (
          <div key={o.orderId || i} onClick={() => setSelected(o)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 52px 60px 52px 60px', gap: 8, padding: '8px 6px', borderRadius: 8, background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: 'pointer' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.ref ? `#${o.ref}` : '—'}
                </span>
                {o.createdAt && (
                  <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(o.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}
                  </span>
                )}
              </div>
              {o.name && <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', marginTop: 1 }}>{o.name}</span>}
            </div>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', alignSelf: 'center' }}>{o.prepMin != null ? `${o.prepMin}m` : '—'}</span>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', alignSelf: 'center' }}>{o.transitMin != null ? `${o.transitMin}m` : '—'}</span>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 800, color: o.totalMin != null ? timeColor(o.totalMin) : 'var(--ink-3)', textAlign: 'right', alignSelf: 'center' }}>{o.totalMin != null ? `${o.totalMin}m` : '—'}</span>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', alignSelf: 'center' }}>{o.deliveryFee > 0 ? clp(o.deliveryFee) : '—'}</span>
          </div>
        ))}

        {/* Fila total */}
        {kpiCostoTotal > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 60px 52px 60px', gap: 8, padding: '8px 6px', borderTop: '1px solid var(--line)', marginTop: 4 }}>
            <span style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 700, color: 'var(--ink)' }}>
              {selectedDate || q ? `Total filtrado (${filtered.length})` : `Total (${filtered.length})`}
            </span>
            <span /><span /><span />
            <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 900, color: 'var(--ink)', textAlign: 'right' }}>{clp(kpiCostoTotal)}</span>
          </div>
        )}
      </div>

      {/* Paginador */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 10px', cursor: page === 0 ? 'default' : 'pointer', color: page === 0 ? 'var(--ink-4)' : 'var(--ink)', fontFamily: F, fontSize: '0.8rem' }}>‹ Anterior</button>
          <span style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink-3)' }}>
            {page + 1} / {totalPages} · {filtered.length} resultados
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 10px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', color: page >= totalPages - 1 ? 'var(--ink-4)' : 'var(--ink)', fontFamily: F, fontSize: '0.8rem' }}>Siguiente ›</button>
        </div>
      )}

      {selected && <DeliveryOrderModal order={selected} restaurantId={restaurantId} onClose={() => setSelected(null)} />}
    </Card>
  )
}

// ── Métodos de pago ───────────────────────────────────────────────
function PaymentMethodsSection({ methods, total }: { methods: PaymentMethod[]; total: number }) {
  if (!methods || methods.length === 0) return null
  const palette = ['var(--amber)', GREEN, BLUE, PURPLE, '#ef4444', '#0ea5e9']
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Métodos de pago</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{methods.reduce((s, m) => s + m.count, 0)} pedidos</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {methods.map((m, i) => {
          const pct = total > 0 ? Math.round((m.count / methods.reduce((s, x) => s + x.count, 0)) * 100) : 0
          const color = palette[i % palette.length]
          return (
            <div key={m.method}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: F, fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                  {m.label}
                </span>
                <span style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', flexShrink: 0 }}>
                  {m.count} ped. <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 400, color: 'var(--ink-3)' }}>({pct}%)</span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .3s' }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Cancelaciones ─────────────────────────────────────────────────
function CancellationsSection({ data }: { data: CancellationData }) {
  if (data.count === 0) return null
  const rateColor = data.rate <= 5 ? GREEN : data.rate <= 15 ? 'var(--amber)' : '#ef4444'
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Cancelaciones</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 700, color: rateColor, background: rateColor + '18', padding: '2px 8px', borderRadius: 999 }}>{data.rate}% tasa</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: data.reasons.length > 0 ? 14 : 0 }}>
        <div style={{ flex: 1, background: 'var(--sunk)', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${rateColor}` }}>
          <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Cancelados</div>
          <div style={{ fontFamily: F, fontSize: '1.2rem', fontWeight: 900, color: 'var(--ink)' }}>{data.count}</div>
        </div>
      </div>
      {data.reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Motivos</div>
          {data.reasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--sunk)', borderRadius: 8 }}>
              <span style={{ fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-2)' }}>{r.reason}</span>
              <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)' }}>{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Satisfacción / NPS ────────────────────────────────────────────
interface SurveyAvg { id: string; text: string; avg: number; count: number }
interface SurveyResp { id: string; customerName: string | null; comment: string | null; createdAt: string; answers: { id: string; text: string; v: number }[] }

function StarBar({ avg }: { avg: number }) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {stars.map(s => (
        <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s <= Math.round(avg) ? 'var(--amber)' : 'none'} stroke="var(--amber)" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  )
}

function SatisfaccionSection({ restaurantId }: { restaurantId: string }) {
  const [averages, setAverages] = useState<SurveyAvg[]>([])
  const [responses, setResponses] = useState<SurveyResp[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/panel/ecommerce/survey/responses?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.total > 0) { setAverages(d.averages); setResponses(d.responses) } })
      .finally(() => setLoaded(true))
  }, [restaurantId])

  if (!loaded || averages.length === 0 || averages.every(a => a.count === 0)) return null

  const withData = averages.filter(a => a.count > 0)
  const overall = withData.reduce((s, a) => s + a.avg, 0) / (withData.length || 1)
  const lastComments = responses.filter(r => r.comment).slice(0, 3)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Satisfacción</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StarBar avg={overall} />
          <span style={{ fontFamily: F, fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)' }}>{overall.toFixed(1)}</span>
          <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{withData[0]?.count ?? 0} resp.</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: lastComments.length > 0 ? 14 : 0 }}>
        {withData.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: F, fontSize: '0.78rem', color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <StarBar avg={a.avg} />
              <span style={{ fontFamily: F, fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)', minWidth: 24, textAlign: 'right' }}>{a.avg.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
      {lastComments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Últimos comentarios</div>
          {lastComments.map(r => (
            <div key={r.id} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ fontFamily: F, fontSize: '0.76rem', color: 'var(--ink)', fontStyle: 'italic', marginBottom: 2 }}>"{r.comment}"</div>
              {r.customerName && <div style={{ fontFamily: F, fontSize: '0.64rem', color: 'var(--ink-3)' }}>— {r.customerName}</div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Platos: vistas vs vendidos ────────────────────────────────────
interface DishView { name: string; views: number; cartAdds: number; avgDwellMs: number | null }

type PlatosSortKey = 'sold' | 'revenue' | 'views' | 'convRate'

function PlatosSection({ restaurantId, fromDate, toDate, products, loading: reportLoading }: {
  restaurantId: string; fromDate: string; toDate: string
  products: ProductRank[]; loading: boolean
}) {
  const [dishViews, setDishViews] = useState<DishView[]>([])
  const [viewsLoading, setViewsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<PlatosSortKey>('sold')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    setViewsLoading(true)
    fetch(`/api/panel/ecommerce/pos-orders/dish-insights?restaurantId=${restaurantId}&from=${fromDate}&to=${toDate}`)
      .then(r => r.ok ? r.json() : { dishes: [] })
      .then(d => setDishViews(d.dishes || []))
      .finally(() => setViewsLoading(false))
  }, [restaurantId, fromDate, toDate])

  const loading = reportLoading || viewsLoading

  const viewMap = new Map(dishViews.map(d => [d.name.toLowerCase(), d]))

  const rows = products.map(p => {
    const v = viewMap.get(p.name.toLowerCase())
    const views = v?.views ?? 0
    return {
      name: p.name,
      sold: p.qty,
      revenue: p.revenue,
      views,
      cartAdds: v?.cartAdds ?? 0,
      convRate: views > 0 && p.qty > 0 ? Math.min(100, Math.round((p.qty / views) * 100)) : null,
    }
  })

  const soldNames = new Set(products.map(p => p.name.toLowerCase()))
  const viewOnly = dishViews.filter(d => !soldNames.has(d.name.toLowerCase())).map(d => ({
    name: d.name, sold: 0, revenue: 0, views: d.views, cartAdds: d.cartAdds, convRate: null,
  }))

  const unsorted = [...rows, ...viewOnly]
  const all = unsorted.slice().sort((a, b) => {
    const av = a[sortKey] ?? -1
    const bv = b[sortKey] ?? -1
    return sortAsc ? av - bv : bv - av
  })

  const toggleSort = (key: PlatosSortKey) => {
    if (sortKey === key) setSortAsc(x => !x)
    else { setSortKey(key); setSortAsc(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Cargando…
    </div>
  )

  if (all.length === 0) return (
    <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0', fontSize: '0.84rem' }}>Sin datos en el período.</p></Card>
  )

  const hasViews = all.some(r => r.views > 0)

  const thSt = (col: PlatosSortKey): React.CSSProperties => ({
    textAlign: 'right', padding: '0 0 8px 8px', fontFamily: F, fontSize: '0.62rem', fontWeight: 700,
    color: sortKey === col ? 'var(--ink)' : 'var(--ink-3)', textTransform: 'uppercase',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  })

  const SortArrow = ({ col }: { col: PlatosSortKey }) => (
    <svg width="9" height="9" viewBox="0 0 10 10" style={{ marginLeft: 2, opacity: sortKey === col ? 1 : 0.3 }}>
      {sortAsc && sortKey === col
        ? <path d="M5 2L9 8H1z" fill="currentColor"/>
        : <path d="M5 8L1 2H9z" fill="currentColor"/>}
    </svg>
  )

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Platos</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{all.length} productos</span>
      </div>
      {!hasViews && (
        <p style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: 12 }}>Las vistas provienen del menú e-commerce. Si el local no usa tienda online, solo se muestran ventas POS.</p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0 8px 8px 0', fontFamily: F, fontSize: '0.62rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Plato</th>
              <th style={thSt('sold')} onClick={() => toggleSort('sold')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Vendidos<SortArrow col="sold"/></span>
              </th>
              <th style={thSt('revenue')} onClick={() => toggleSort('revenue')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Venta<SortArrow col="revenue"/></span>
              </th>
              {hasViews && <>
                <th style={thSt('views')} onClick={() => toggleSort('views')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>Vistas<SortArrow col="views"/></span>
                </th>
                <th style={thSt('convRate')} onClick={() => toggleSort('convRate')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>Conv.<SortArrow col="convRate"/></span>
                </th>
              </>}
            </tr>
          </thead>
          <tbody>
            {all.slice(0, 60).map((r, i) => {
              const convColor = r.convRate === null ? 'var(--ink-3)' : r.convRate >= 20 ? GREEN : r.convRate >= 10 ? 'var(--amber)' : '#ef4444'
              return (
                <tr key={r.name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--sunk)' }}>
                  <td style={{ padding: '7px 8px 7px 0', fontSize: '0.82rem', fontWeight: 600, color: r.sold === 0 ? 'var(--ink-3)' : 'var(--ink)', width: '50%' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 5 }}>
                      <span style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 5, background: i < 3 ? 'var(--amber-tint)' : 'var(--sunk)', color: i < 3 ? 'var(--amber)' : 'var(--ink-3)', fontSize: '0.6rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      {r.name}
                    </span>
                  </td>
                  <td style={{ padding: '7px 0 7px 8px', fontSize: '0.82rem', fontWeight: 800, color: r.sold > 0 ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.sold > 0 ? `${r.sold} u.` : '—'}</td>
                  <td style={{ padding: '7px 0 7px 8px', fontSize: '0.82rem', color: r.revenue > 0 ? 'var(--ink)' : 'var(--ink-4)', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.revenue > 0 ? clp(r.revenue) : '—'}</td>
                  {hasViews && <>
                    <td style={{ padding: '7px 0 7px 8px', fontSize: '0.82rem', color: r.views > 0 ? 'var(--ink-2)' : 'var(--ink-4)', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.views > 0 ? r.views : '—'}</td>
                    <td style={{ padding: '7px 0 7px 8px', fontSize: '0.8rem', fontWeight: 700, color: convColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.convRate !== null ? `${r.convRate}%` : '—'}
                    </td>
                  </>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {all.length > 60 && <p style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', textAlign: 'center', margin: '10px 0 0' }}>Mostrando 60 de {all.length}</p>}
      </div>
    </Card>
  )
}

// ── Merge arrays by key, summing numeric fields ───────────────────
function mergeByKey(items: Record<string, any>[], key: string, sumKeys: string[]): any[] {
  const map = new Map<string | number, Record<string, any>>()
  for (const item of items) {
    const k = item[key]
    if (map.has(k)) {
      const ex = map.get(k)!
      for (const sk of sumKeys) ex[sk] = (ex[sk] || 0) + (item[sk] || 0)
    } else { map.set(k, { ...item }) }
  }
  return Array.from(map.values())
}

// ── Date range picker ─────────────────────────────────────────────
function DateRangePicker({ fromDate, toDate, today, onFromChange, onToChange, onShift, onReset }: {
  fromDate: string; toDate: string; today: string
  onFromChange: (v: string) => void; onToChange: (v: string) => void
  onShift: (days: number) => void; onReset: () => void; onRefresh?: () => void
}) {
  const singleDay = fromDate === toDate
  const inputSt: React.CSSProperties = {
    fontFamily: F, fontSize: '0.82rem', color: 'var(--ink)',
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 8, padding: '7px 6px', cursor: 'pointer', minWidth: 0, flex: '1 1 0',
  }
  const navBtn: React.CSSProperties = {
    width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)',
    color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0,
  }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      {singleDay && (
        <button onClick={() => onShift(-1)} style={navBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}
      <input type="date" value={fromDate} max={toDate} onChange={e => onFromChange(e.target.value || today)} style={inputSt} />
      <span style={{ fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-3)', flexShrink: 0 }}>–</span>
      <input type="date" value={toDate} min={fromDate} onChange={e => onToChange(e.target.value || today)} style={inputSt} />
      {singleDay && (
        <button onClick={() => onShift(1)} disabled={fromDate >= today} style={{ ...navBtn, opacity: fromDate >= today ? 0.4 : 1, cursor: fromDate >= today ? 'default' : 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}
      {(fromDate !== today || toDate !== today) && (
        <button onClick={onReset} style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-tint)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}>Hoy</button>
      )}
    </div>
  )
}

// ── Histórico anual (VentaDia) ──────────────────────────────────────
interface VentaMonth {
  yearMonth: string; totalBruto: number; totalNeto: number; numOrdenes: number
  ventaMercat: number; ventaUber: number; numDias: number; avgMargen: number | null
}
interface DowStat { dow: number; avg: number; count: number }
interface HistoricoData {
  months: VentaMonth[]
  currentMonthDays: { fecha: string; totalBruto: number; ventaMercat: number; ventaUber: number }[]
  last7Total: number
  totalRows: number
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function ByMonthChart({ data }: { data: { ym: string; sales: number; orders: number }[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  if (!data || data.length === 0) return (
    <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.82rem' }}>Sin datos en el período.</p></Card>
  )
  const maxSales = Math.max(1, ...data.map(d => d.sales))
  const multiYear = new Set(data.map(d => d.ym.slice(0, 4))).size > 1
  return (
    <Card>
      <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>Por mes</div>
      <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: 18 }}>
        Venta neta con IVA
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
        {data.map(d => {
          const pct = d.sales > 0 ? Math.max(8, Math.round((d.sales / maxSales) * 100)) : 0
          const isHovered = hovered === d.ym
          const monthIdx = parseInt(d.ym.slice(5, 7), 10) - 1
          const monthLabel = MONTH_LABELS[monthIdx] ?? d.ym.slice(5, 7)
          const yearLabel = d.ym.slice(0, 4)
          return (
            <div key={d.ym}
              style={{ flex: '1 0 44px', minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: d.sales > 0 ? 'pointer' : 'default' }}
              onMouseEnter={() => d.sales > 0 && setHovered(d.ym)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                {isHovered && d.sales > 0 && (
                  <div style={{
                    position: 'absolute', bottom: `${pct}%`, left: '50%', transform: 'translateX(-50%) translateY(-6px)',
                    background: 'var(--ink)', color: 'var(--surface)', borderRadius: 8,
                    padding: '5px 9px', zIndex: 10, whiteSpace: 'nowrap', pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,.18)',
                  }}>
                    <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 900 }}>{clp(d.sales)}</div>
                    <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'rgba(255,255,255,.65)', marginTop: 1 }}>{monthLabel} {yearLabel} · {d.orders} pedidos</div>
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--ink)' }} />
                  </div>
                )}
                {d.sales > 0 && !isHovered && (
                  <span style={{
                    position: 'absolute', bottom: `${pct}%`, left: '50%',
                    transform: 'translateX(-50%) translateY(-4px)',
                    fontFamily: F, fontSize: '0.52rem', fontWeight: 700,
                    color: 'var(--ink-3)', whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}>{clpShort(d.sales)}</span>
                )}
                <div style={{
                  width: '70%', maxWidth: 32,
                  height: `${pct}%`, minHeight: d.sales > 0 ? 4 : 0,
                  background: isHovered
                    ? `linear-gradient(180deg,${GREEN},${GREEN}cc)`
                    : `linear-gradient(180deg,${GREEN}bb,${GREEN}77)`,
                  borderRadius: '5px 5px 0 0',
                  transform: isHovered ? 'scaleX(1.12)' : 'scaleX(1)',
                  transformOrigin: 'bottom',
                  transition: 'transform .15s ease, background .15s ease',
                  boxShadow: isHovered ? `0 0 0 2px ${GREEN}55` : 'none',
                }} />
              </div>
              <span style={{ fontFamily: F, fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-2)', marginTop: 5, whiteSpace: 'nowrap' }}>{monthLabel}</span>
              {multiYear && <span style={{ fontFamily: F, fontSize: '0.52rem', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{yearLabel}</span>}
              {d.orders > 0 && <span style={{ fontFamily: F, fontSize: '0.52rem', color: 'var(--ink-4)' }}>{d.orders}p</span>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ByYearChart({ data }: { data: { yr: string; sales: number; orders: number }[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  if (!data || data.length === 0) return (
    <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.82rem' }}>Sin datos en el período.</p></Card>
  )
  const maxSales = Math.max(1, ...data.map(d => d.sales))
  return (
    <Card>
      <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>Por año</div>
      <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: 18 }}>
        Venta neta con IVA
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {data.map(d => {
          const pct = d.sales > 0 ? Math.max(8, Math.round((d.sales / maxSales) * 100)) : 0
          const isHovered = hovered === d.yr
          return (
            <div key={d.yr}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: d.sales > 0 ? 'pointer' : 'default' }}
              onMouseEnter={() => d.sales > 0 && setHovered(d.yr)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                {isHovered && d.sales > 0 && (
                  <div style={{
                    position: 'absolute', bottom: `${pct}%`, left: '50%', transform: 'translateX(-50%) translateY(-6px)',
                    background: 'var(--ink)', color: 'var(--surface)', borderRadius: 8,
                    padding: '5px 9px', zIndex: 10, whiteSpace: 'nowrap', pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,.18)',
                  }}>
                    <div style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 900 }}>{clp(d.sales)}</div>
                    <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'rgba(255,255,255,.65)', marginTop: 1 }}>{d.yr} · {d.orders} pedidos</div>
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--ink)' }} />
                  </div>
                )}
                {d.sales > 0 && !isHovered && (
                  <span style={{
                    position: 'absolute', bottom: `${pct}%`, left: '50%',
                    transform: 'translateX(-50%) translateY(-4px)',
                    fontFamily: F, fontSize: '0.6rem', fontWeight: 700,
                    color: 'var(--ink-3)', whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}>{clpShort(d.sales)}</span>
                )}
                <div style={{
                  width: '65%', maxWidth: 48,
                  height: `${pct}%`, minHeight: d.sales > 0 ? 4 : 0,
                  background: isHovered
                    ? `linear-gradient(180deg,${BLUE},${BLUE}cc)`
                    : `linear-gradient(180deg,${BLUE}bb,${BLUE}77)`,
                  borderRadius: '6px 6px 0 0',
                  transform: isHovered ? 'scaleX(1.08)' : 'scaleX(1)',
                  transformOrigin: 'bottom',
                  transition: 'transform .15s ease, background .15s ease',
                  boxShadow: isHovered ? `0 0 0 2px ${BLUE}55` : 'none',
                }} />
              </div>
              <span style={{ fontFamily: F, fontSize: '0.76rem', fontWeight: 800, color: 'var(--ink-2)', marginTop: 5 }}>{d.yr}</span>
              {d.orders > 0 && <span style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-4)' }}>{d.orders}p</span>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const DOW_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function DowStatsChart({ stats }: { stats: DowStat[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  // Reordenar lun→dom
  const ds = [...stats].sort((a, b) => {
    const aa = a.dow === 0 ? 7 : a.dow
    const bb = b.dow === 0 ? 7 : b.dow
    return aa - bb
  })
  const active = ds.filter(d => d.count > 0)
  const sorted = [...active].sort((a, b) => b.avg - a.avg)
  const maxAvg = Math.max(1, ...ds.map(x => x.avg))
  const best = active.reduce((a, b) => a.avg > b.avg ? a : b)
  const worst = active.reduce((a, b) => a.avg < b.avg ? a : b)

  return (
    <Card>
      <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>Por día de semana</div>
      <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: 18 }}>
        Promedio de venta neta · verde = mejor, rojo = peor
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        {ds.map(d => {
          const pct = d.avg > 0 ? Math.max(8, Math.round((d.avg / maxAvg) * 100)) : 0
          const rank = sorted.findIndex(s => s.dow === d.dow)
          const color = d.avg > 0 ? dowRankColor(rank, sorted.length) : 'var(--line)'
          const isBest = best.dow === d.dow
          const isWorst = worst.dow === d.dow
          const isHovered = hovered === d.dow
          return (
            <div key={d.dow}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: d.avg > 0 ? 'pointer' : 'default' }}
              onMouseEnter={() => d.avg > 0 && setHovered(d.dow)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Bar container — valor flota encima de la barra */}
              <div style={{ width: '100%', height: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                {/* Tooltip al hacer hover */}
                {isHovered && d.avg > 0 && (
                  <div style={{
                    position: 'absolute', bottom: `${pct}%`, left: '50%', transform: 'translateX(-50%) translateY(-6px)',
                    background: 'var(--ink)', color: 'var(--surface)', borderRadius: 8,
                    padding: '5px 9px', zIndex: 10, whiteSpace: 'nowrap', pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,.18)',
                  }}>
                    <div style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 900 }}>{clp(d.avg)}</div>
                    <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'rgba(255,255,255,.65)', marginTop: 1 }}>{DOW_LABEL[d.dow]} · {d.count} {d.count === 1 ? 'día' : 'días'}</div>
                    {/* flecha */}
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--ink)' }} />
                  </div>
                )}
                {/* Valor encima de la barra (posicionado relativo a la barra) */}
                {d.avg > 0 && !isHovered && (
                  <span style={{
                    position: 'absolute', bottom: `${pct}%`, left: '50%',
                    transform: 'translateX(-50%) translateY(-4px)',
                    fontFamily: F, fontSize: '0.52rem', fontWeight: 700,
                    color: 'var(--ink-3)', whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}>{clpShort(d.avg)}</span>
                )}
                <div style={{
                  width: '72%', maxWidth: 30,
                  height: `${pct}%`,
                  background: isHovered
                    ? `linear-gradient(180deg,${color},${color}cc)`
                    : `linear-gradient(180deg,${color}bb,${color}77)`,
                  borderRadius: '5px 5px 0 0',
                  minHeight: d.avg > 0 ? 4 : 0,
                  transform: isHovered ? 'scaleX(1.15)' : 'scaleX(1)',
                  transformOrigin: 'bottom',
                  transition: 'transform .15s ease, background .15s ease',
                  boxShadow: isHovered ? `0 0 0 2px ${color}66` : 'none',
                }} />
              </div>
              <span style={{ fontFamily: F, fontSize: '0.65rem', fontWeight: 700, color: isBest ? GREEN : isWorst ? '#ef4444' : 'var(--ink-2)', marginTop: 5 }}>
                {DOW_LABEL[d.dow]}
              </span>
              {d.count > 0 && <span style={{ fontFamily: F, fontSize: '0.52rem', color: 'var(--ink-4)' }}>{d.count}d</span>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function dowRankColor(rank: number, total: number): string {
  if (total <= 1) return GREEN
  const t = rank / (total - 1)
  let r: number, g: number, b: number
  if (t <= 0.5) {
    r = Math.round(34  + (245 - 34)  * (t * 2))
    g = Math.round(197 + (158 - 197) * (t * 2))
    b = Math.round(94  + (11  - 94)  * (t * 2))
  } else {
    const t2 = (t - 0.5) * 2
    r = Math.round(245 + (239 - 245) * t2)
    g = Math.round(158 + (68  - 158) * t2)
    b = Math.round(11  + (68  - 11)  * t2)
  }
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function HistoricoAnualSection({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<HistoricoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'bruto' | 'mercat' | 'uber'>('bruto')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/panel/ecommerce/venta-historica?restaurantId=${restaurantId}&year=2026`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [restaurantId])

  if (loading) return (
    <Card><div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Cargando histórico…
    </div></Card>
  )
  if (!data || data.months.length === 0) return (
    <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0', fontSize: '0.82rem' }}>Sin datos históricos importados.</p></Card>
  )

  const months = data.months
  const getVal = (m: VentaMonth) => viewMode === 'mercat' ? m.ventaMercat : viewMode === 'uber' ? m.ventaUber : m.totalBruto
  const maxVal = Math.max(1, ...months.map(getVal))
  const totalYear = months.reduce((s, m) => s + getVal(m), 0)
  const avgMonth = months.length > 0 ? Math.round(totalYear / months.length) : 0

  // Proyección mes actual
  const todayYm = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()).slice(0, 7)
  const currentMonth = months.find(m => m.yearMonth === todayYm)
  const currentDays = data.currentMonthDays
  const currentTotal = currentDays.reduce((s, d) => s + d.totalBruto, 0)
  const daysElapsed = currentDays.length
  const totalDaysInMonth = new Date(parseInt(todayYm.slice(0, 4)), parseInt(todayYm.slice(5, 7)), 0).getDate()
  const dailyAvgSoFar = daysElapsed > 0 ? currentTotal / daysElapsed : 0
  const projection = Math.round(dailyAvgSoFar * totalDaysInMonth)
  // Find same month last year or same month historical avg
  const prevSameName = months.find(m => m.yearMonth !== todayYm && m.yearMonth.endsWith(todayYm.slice(5)))
  const histRef = prevSameName?.totalBruto ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Year bar chart */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
          <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Año 2026</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['bruto', 'mercat', 'uber'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                fontFamily: F, fontSize: '0.66rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer',
                background: viewMode === v ? 'var(--amber-tint-2)' : 'var(--sunk)',
                color: viewMode === v ? 'var(--amber-press)' : 'var(--ink-3)',
                borderColor: viewMode === v ? 'var(--amber)' : 'var(--line)',
              }}>{v === 'bruto' ? 'Total' : v === 'mercat' ? 'Online' : 'Uber'}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontFamily: F, fontSize: '0.75rem', color: 'var(--ink-2)' }}>Total: <strong>{clp(totalYear)}</strong></span>
          <span style={{ fontFamily: F, fontSize: '0.75rem', color: 'var(--ink-2)' }}>Prom./mes: <strong>{clp(avgMonth)}</strong></span>
        </div>
        <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingTop: 20, paddingBottom: 16, overflowX: 'auto', overflowY: 'hidden' }}>
          {months.map(m => {
            const val = getVal(m)
            const pct = val > 0 ? Math.max(4, Math.round((val / maxVal) * 100)) : 0
            const mn = parseInt(m.yearMonth.slice(5)) - 1
            const isToday = m.yearMonth === todayYm
            return (
              <div key={m.yearMonth} style={{ flex: '1 0 44px', minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{
                    position: 'relative', width: '70%', maxWidth: 32,
                    height: `${pct}%`,
                    background: isToday
                      ? `linear-gradient(180deg,var(--amber),var(--amber)bb)`
                      : `linear-gradient(180deg,${GREEN},${GREEN}bb)`,
                    borderRadius: '4px 4px 0 0',
                    minHeight: val > 0 ? 3 : 0,
                  }}>
                    {val > 0 && (
                      <span style={{ position: 'absolute', bottom: '100%', marginBottom: 2, left: '50%', transform: 'translateX(-50%)', fontFamily: F, fontSize: '0.56rem', fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{clpShort(val)}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: isToday ? 'var(--amber-press)' : 'var(--ink-2)', marginTop: 4 }}>{MONTH_SHORT[mn]}</span>
                <span style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-3)' }}>{m.numDias}d</span>
              </div>
            )
          })}
        </div>
        {/* scroll hint fade derecho */}
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 32, background: 'linear-gradient(to right, transparent, var(--surface))', pointerEvents: 'none', borderRadius: '0 12px 12px 0' }} />
        </div>
      </Card>

      {/* Proyección mes actual */}
      {daysElapsed > 0 && (
        <Card>
          <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
            Proyección · {MONTH_SHORT[(parseInt(todayYm.slice(5)) - 1 + 12) % 12]} {todayYm.slice(0, 4)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>Lleva</div>
              <div style={{ fontFamily: F, fontSize: '0.95rem', fontWeight: 900, color: 'var(--ink)' }}>{clpShort(currentTotal)}</div>
              <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 2 }}>{daysElapsed} días</div>
            </div>
            <div style={{ background: 'var(--amber-tint)', borderRadius: 10, padding: '10px 12px', borderLeft: '3px solid var(--amber)' }}>
              <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--amber-press)', textTransform: 'uppercase', marginBottom: 4 }}>Proyecta</div>
              <div style={{ fontFamily: F, fontSize: '0.95rem', fontWeight: 900, color: 'var(--amber-press)' }}>{clpShort(projection)}</div>
              <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 2 }}>al ritmo actual</div>
            </div>
            {histRef != null && (
              <div style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>Histórico</div>
                <div style={{ fontFamily: F, fontSize: '0.95rem', fontWeight: 900, color: 'var(--ink)' }}>{clpShort(histRef)}</div>
                <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 2 }}>mismo mes</div>
              </div>
            )}
            {currentMonth && currentMonth.numDias > 0 && (
              <div style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px', gridColumn: histRef != null ? undefined : 'span 2' }}>
                <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>Prom. día</div>
                <div style={{ fontFamily: F, fontSize: '0.95rem', fontWeight: 900, color: 'var(--ink)' }}>{clpShort(Math.round(currentTotal / daysElapsed))}</div>
                <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 2 }}>con venta</div>
              </div>
            )}
          </div>
        </Card>
      )}

    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────
interface BranchInfo { id: string; name: string; branchName?: string | null }

interface HeatPt { lat: number; lng: number }

// ── Tipos para sección Clientes ──────────────────────────────────────
type ClientStatus = 'active' | 'at_risk' | 'churned' | 'new'
interface ClientRow {
  email: string; name: string; phone: string
  orders: number; totalSpent: number; avgTicket: number
  lastOrderAt: string; daysSinceLastOrder: number
  avgFrequencyDays: number | null
  status: ClientStatus; riskScore: number
}
interface ClientsData {
  total: number
  byStatus: { active: number; at_risk: number; churned: number; new: number }
  clients: ClientRow[]
}

type ClientSortKey = 'riskScore' | 'totalSpent' | 'orders' | 'lastOrderAt' | 'avgFrequencyDays' | 'avgTicket'

const STATUS_LABEL: Record<ClientStatus, string> = { active: 'Activo', at_risk: 'En riesgo', churned: 'Perdido', new: 'Nuevo' }
const STATUS_COLOR: Record<ClientStatus, string> = { active: 'var(--jade)', at_risk: 'var(--amber)', churned: '#ef4444', new: 'var(--slate)' }
const STATUS_BG: Record<ClientStatus, string>    = { active: 'var(--jade-tint)', at_risk: 'var(--amber-tint)', churned: '#fef2f2', new: 'var(--slate-tint)' }

function ClientsSection({ restaurantId }: { restaurantId: string }) {
  const [cd, setCd] = useState<ClientsData | null>(null)
  const [clLoading, setClLoading] = useState(true)
  const [sortKey, setSortKey] = useState<ClientSortKey>('riskScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setClLoading(true)
    fetch(`/api/panel/ecommerce/pos-orders/clients?restaurantId=${restaurantId}&limit=500`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCd(d) })
      .finally(() => setClLoading(false))
  }, [restaurantId])

  const toggleSort = (key: ClientSortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const rows = cd?.clients ?? []
  const filtered = rows.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)
    }
    return true
  })
  const sorted = filtered.slice().sort((a, b) => {
    let av: number, bv: number
    if (sortKey === 'lastOrderAt') {
      av = new Date(a.lastOrderAt).getTime(); bv = new Date(b.lastOrderAt).getTime()
    } else {
      av = a[sortKey] ?? 0; bv = b[sortKey] ?? 0
    }
    return sortAsc ? av - bv : bv - av
  })

  const SortArrow = ({ col }: { col: ClientSortKey }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 3, opacity: sortKey === col ? 1 : 0.3 }}>
      {sortAsc && sortKey === col
        ? <path d="M5 2L9 8H1z" fill="currentColor"/>
        : <path d="M5 8L1 2H9z" fill="currentColor"/>}
    </svg>
  )

  const thSt = (col: ClientSortKey): React.CSSProperties => ({
    fontFamily: F, fontSize: '0.62rem', fontWeight: 700, color: sortKey === col ? 'var(--ink)' : 'var(--ink-3)',
    textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '0 6px 8px 0',
  })

  if (clLoading) return <Card><div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Cargando clientes…</div></Card>
  if (!cd) return null

  const allRows = cd.clients
  const totalGastado = allRows.reduce((s, c) => s + c.totalSpent, 0)
  const avgGastoCliente = allRows.length > 0 ? Math.round(totalGastado / allRows.length) : 0
  const avgTicketGlobal = allRows.length > 0 ? Math.round(allRows.reduce((s, c) => s + c.avgTicket, 0) / allRows.length) : 0

  // Podio VIP: top 3 por gasto total
  const bySpend = allRows.slice().sort((a, b) => b.totalSpent - a.totalSpent)
  const top3 = bySpend.slice(0, 3)

  // 80/20: cuántos clientes generan el 80% del ingreso
  const target80 = totalGastado * 0.8
  let acc80 = 0, count80 = 0
  for (const c of bySpend) { acc80 += c.totalSpent; count80++; if (acc80 >= target80) break }
  const pct80clients = allRows.length > 0 ? Math.round((count80 / allRows.length) * 100) : 0

  // Más fieles: top 5 por frecuencia (menor avgFrequencyDays)
  const fieles = allRows
    .filter(c => c.avgFrequencyDays !== null && c.orders >= 3)
    .sort((a, b) => (a.avgFrequencyDays ?? 999) - (b.avgFrequencyDays ?? 999))
    .slice(0, 5)

  // Clientes a recuperar: at_risk o churned con 3+ pedidos, ordenados por gasto desc
  const aRecuperar = allRows
    .filter(c => (c.status === 'at_risk' || c.status === 'churned') && c.orders >= 3)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5)

  // Nuevos este mes (status new)
  const nuevosEsteMes = cd.byStatus.new

  // Distribución de salud: porcentajes
  const totalForPct = cd.total || 1

  // Avatar helper
  const initials = (c: ClientRow) => {
    const n = c.name || c.email || c.phone || '?'
    return n.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?'
  }
  const avatarBg = (c: ClientRow) => {
    const h = (c.email + c.phone).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
    const colors = ['#3b82f6','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444']
    return colors[h % colors.length]
  }

  const MEDAL = ['🥇','🥈','🥉']
  const MEDAL_BG = ['linear-gradient(135deg,#FEF3C7,#FDE68A)','linear-gradient(135deg,#F1F5F9,#E2E8F0)','linear-gradient(135deg,#FEF0E0,#FDDBB8)']
  const MEDAL_BORDER = ['#F59E0B','#94A3B8','#B45309']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── KPIs fila ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {[
          { label: 'Total clientes', value: cd.total.toLocaleString('es-CL'), color: BLUE },
          { label: 'Total gastado', value: clpShort(totalGastado), color: GREEN },
          { label: 'Gasto prom. cliente', value: clp(avgGastoCliente), color: PURPLE },
          { label: 'Ticket promedio', value: clp(avgTicketGlobal), color: 'var(--amber)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', borderTop: `4px solid ${k.color}` }}>
            <div style={{ fontFamily: F, fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: F, fontSize: '1.45rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Podio VIP ── */}
      {top3.length > 0 && (
        <Card style={{ padding: '16px 14px' }}>
          <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Top clientes VIP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top3.map((c, i) => (
              <div key={c.email || c.phone} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: MEDAL_BG[i], border: `1px solid ${MEDAL_BORDER[i]}`,
                borderRadius: 14, padding: '12px 14px',
              }}>
                {/* Medal + rank */}
                <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{MEDAL[i]}</div>
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: avatarBg(c), display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: F, fontSize: '0.82rem', fontWeight: 900, color: '#fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,.12)',
                }}>{initials(c)}</div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name || c.email || c.phone}
                  </div>
                  {(c.email || c.phone) && c.name && (
                    <div style={{ fontFamily: F, fontSize: '0.65rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.phone || c.email}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F, fontSize: '0.65rem', color: 'var(--ink-2)' }}>{c.orders} pedidos</span>
                    {c.avgFrequencyDays && <span style={{ fontFamily: F, fontSize: '0.65rem', color: 'var(--ink-2)' }}>c/{c.avgFrequencyDays}d</span>}
                    <span style={{ fontFamily: F, fontSize: '0.65rem', color: 'var(--ink-2)' }}>⌀{clp(c.avgTicket)}</span>
                  </div>
                </div>
                {/* Total gastado */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '1.05rem', fontWeight: 900, color: 'var(--ink)' }}>{clpShort(c.totalSpent)}</div>
                  <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 1 }}>gastado</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 80/20 + Nuevos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* 80/20 */}
        <Card style={{ padding: '14px' }}>
          <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Regla 80/20</div>
          <div style={{ fontFamily: F, fontSize: '2rem', fontWeight: 900, color: BLUE, lineHeight: 1 }}>{pct80clients}%</div>
          <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4 }}>
            de tus clientes genera el <strong>80%</strong> de los ingresos
          </div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'var(--sunk)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct80clients}%`, background: `linear-gradient(90deg,${BLUE},${PURPLE})`, borderRadius: 999 }} />
          </div>
          <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 4 }}>{count80} de {allRows.length} clientes</div>
        </Card>

        {/* Nuevos este mes */}
        <Card style={{ padding: '14px' }}>
          <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Nuevos clientes</div>
          <div style={{ fontFamily: F, fontSize: '2rem', fontWeight: 900, color: GREEN, lineHeight: 1 }}>{nuevosEsteMes}</div>
          <div style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4 }}>
            clientes con su <strong>primer pedido</strong> registrado
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['active','at_risk','churned','new'] as ClientStatus[]).map(s => (
              <span key={s} style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: STATUS_BG[s], color: STATUS_COLOR[s] }}>
                {STATUS_LABEL[s]} {cd.byStatus[s]}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Los más fieles ── */}
      {fieles.length > 0 && (
        <Card style={{ padding: '14px 14px' }}>
          <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Los más fieles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieles.map((c) => (
              <div key={c.email || c.phone} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: avatarBg(c), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F, fontSize: '0.72rem', fontWeight: 900, color: '#fff' }}>{initials(c)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.email || c.phone}</div>
                  <div style={{ fontFamily: F, fontSize: '0.65rem', color: 'var(--ink-3)' }}>{c.orders} pedidos · {clp(c.totalSpent)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 900, color: GREEN }}>c/{c.avgFrequencyDays}d</div>
                  <div style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)' }}>frec.</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Clientes a recuperar ── */}
      {aRecuperar.length > 0 && (
        <Card style={{ padding: '14px', borderLeft: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.08em' }}>Clientes a recuperar</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {aRecuperar.map((c) => (
              <div key={c.email || c.phone} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: avatarBg(c), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F, fontSize: '0.72rem', fontWeight: 900, color: '#fff' }}>{initials(c)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.email || c.phone}</div>
                  <div style={{ fontFamily: F, fontSize: '0.65rem', color: 'var(--ink-3)' }}>{c.orders} pedidos · {clp(c.totalSpent)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: '#ef4444' }}>Hace {c.daysSinceLastOrder}d</div>
                  <span style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: STATUS_BG[c.status], color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Distribución de salud ── */}
      <Card style={{ padding: '14px' }}>
        <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Salud de la base</div>
        {/* Barra compuesta */}
        <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', marginBottom: 12, gap: 1 }}>
          {(['active','new','at_risk','churned'] as ClientStatus[]).map(s => {
            const pct = Math.round((cd.byStatus[s] / totalForPct) * 100)
            return pct > 0 ? <div key={s} style={{ width: `${pct}%`, background: STATUS_COLOR[s], transition: 'width .3s' }} /> : null
          })}
        </div>
        {/* Leyenda + botones filtro */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          <button onClick={() => setFilterStatus('all')}
            style={{ background: filterStatus === 'all' ? 'var(--surface)' : 'var(--sunk)', border: `1.5px solid ${filterStatus === 'all' ? 'var(--ink-3)' : 'var(--line)'}`, borderRadius: 10, padding: '8px 4px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontFamily: F, fontSize: '1rem', fontWeight: 900, color: 'var(--ink)' }}>{cd.total}</div>
            <div style={{ fontFamily: F, fontSize: '0.56rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 2 }}>Todos</div>
          </button>
          {(['active','at_risk','churned','new'] as ClientStatus[]).map(s => {
            const pct = Math.round((cd.byStatus[s] / totalForPct) * 100)
            return (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                style={{ background: filterStatus === s ? STATUS_BG[s] : 'var(--sunk)', border: `1.5px solid ${filterStatus === s ? STATUS_COLOR[s] : 'var(--line)'}`, borderRadius: 10, padding: '8px 4px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontFamily: F, fontSize: '1rem', fontWeight: 900, color: STATUS_COLOR[s] }}>{cd.byStatus[s]}</div>
                <div style={{ fontFamily: F, fontSize: '0.56rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 1 }}>{STATUS_LABEL[s]}</div>
                <div style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-3)' }}>{pct}%</div>
              </button>
            )
          })}
        </div>
      </Card>

    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Directorio de clientes</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{cd.total} únicos</span>
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: F, fontSize: '0.82rem', padding: '8px 12px 8px 32px', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', outline: 'none', '--placeholder-color': 'var(--ink-2)' } as React.CSSProperties}
        />
        <style>{`input[placeholder="Buscar por nombre, email o teléfono…"]::placeholder{color:var(--ink-2);opacity:1}`}</style>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
          <thead>
            <tr>
              <th style={thSt('riskScore')} onClick={() => toggleSort('riskScore')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Riesgo <SortArrow col="riskScore" /></span>
              </th>
              <th style={{ ...thSt('totalSpent'), textAlign: 'left' }} onClick={() => toggleSort('totalSpent')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Cliente <SortArrow col="totalSpent" /></span>
              </th>
              <th style={thSt('orders')} onClick={() => toggleSort('orders')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Pedidos <SortArrow col="orders" /></span>
              </th>
              <th style={thSt('totalSpent')} onClick={() => toggleSort('totalSpent')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Gastado <SortArrow col="totalSpent" /></span>
              </th>
              <th style={thSt('avgTicket')} onClick={() => toggleSort('avgTicket')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>⌀ Ticket <SortArrow col="avgTicket" /></span>
              </th>
              <th style={thSt('avgFrequencyDays')} onClick={() => toggleSort('avgFrequencyDays')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Frec. <SortArrow col="avgFrequencyDays" /></span>
              </th>
              <th style={thSt('lastOrderAt')} onClick={() => toggleSort('lastOrderAt')}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>Último pedido <SortArrow col="lastOrderAt" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((c, i) => (
              <tr key={c.email || c.phone} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', borderRadius: 8 }}>
                {/* Riesgo */}
                <td style={{ padding: '8px 6px 8px 0', textAlign: 'center', width: 56 }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 900, color: STATUS_COLOR[c.status],
                      background: STATUS_BG[c.status], padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {STATUS_LABEL[c.status]}
                    </span>
                    {c.riskScore > 0 && <span style={{ fontSize: '0.6rem', color: 'var(--ink-3)', fontFamily: F }}>{c.riskScore}%</span>}
                  </div>
                </td>
                {/* Nombre/email/teléfono */}
                <td style={{ padding: '8px 6px 8px 0', maxWidth: 180, overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</div>
                  {c.email && <div style={{ fontSize: '0.67rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
                  {c.phone && <div style={{ fontSize: '0.67rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone}</div>}
                </td>
                {/* Pedidos */}
                <td style={{ padding: '8px 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.orders}</td>
                {/* Gastado */}
                <td style={{ padding: '8px 6px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{clp(c.totalSpent)}</td>
                {/* Ticket prom. */}
                <td style={{ padding: '8px 6px', fontSize: '0.78rem', color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>{clp(c.avgTicket)}</td>
                {/* Frecuencia */}
                <td style={{ padding: '8px 6px', fontSize: '0.78rem', color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.avgFrequencyDays !== null ? `c/${c.avgFrequencyDays}d` : '—'}
                </td>
                {/* Último pedido */}
                <td style={{ padding: '8px 0 8px 6px', fontSize: '0.78rem', color: c.daysSinceLastOrder > 90 ? '#ef4444' : 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.daysSinceLastOrder === 0 ? 'Hoy' : `Hace ${c.daysSinceLastOrder}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 100 && (
          <p style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)', textAlign: 'center', margin: '12px 0 0' }}>
            Mostrando 100 de {sorted.length} clientes filtrados
          </p>
        )}
        {sorted.length === 0 && (
          <p style={{ fontFamily: F, fontSize: '0.84rem', color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>Sin clientes para los filtros actuales.</p>
        )}
      </div>
    </Card>
    </div>
  )
}

// ── Satisfacción — tab completa ───────────────────────────────────
interface SurveyFullResponse {
  id: string; orderId: string | null; orderNumber: number | null
  orderTotal: number | null; orderType: string | null; orderItems: string[]
  customerName: string | null; customerPhone: string | null
  comment: string | null; createdAt: string
  answers: { id: string; text: string; v: number }[]
}
interface SurveyFullData {
  total: number
  averages: { id: string; text: string; avg: number; count: number }[]
  responses: SurveyFullResponse[]
  starDist: Record<string, number>
  weeklyTrend: { label: string; avg: number; count: number }[]
}

function MiniStars({ avg, size = 11 }: { avg: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24"
          fill={s <= Math.round(avg) ? 'var(--amber)' : 'none'}
          stroke="var(--amber)" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

function SatisfaccionTabSection({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<SurveyFullData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStar, setFilterStar] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/panel/ecommerce/survey/responses?restaurantId=${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [restaurantId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Cargando…
    </div>
  )

  if (!data || data.total === 0) return (
    <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '48px 0', fontSize: '0.84rem' }}>Aún no hay encuestas respondidas.</p></Card>
  )

  const withData = data.averages.filter(a => a.count > 0)
  const overall = withData.length > 0 ? withData.reduce((s, a) => s + a.avg, 0) / withData.length : 0
  const withComment = data.responses.filter(r => r.comment).length
  const pctComment = data.total > 0 ? Math.round((withComment / data.total) * 100) : 0

  // Trend: comparar última semana vs anterior
  const trend = data.weeklyTrend
  const lastWeek = trend[trend.length - 1]
  const prevWeek = trend[trend.length - 2]
  const trendDiff = lastWeek && prevWeek && prevWeek.avg > 0 ? Math.round((lastWeek.avg - prevWeek.avg) * 10) / 10 : null

  // Feed filtrado
  const filtered = filterStar !== null
    ? data.responses.filter(r => {
        const vs = r.answers.map(a => a.v).filter(v => v >= 1 && v <= 5)
        if (!vs.length) return false
        return Math.round(vs.reduce((s,v) => s+v,0) / vs.length) === filterStar
      })
    : data.responses

  const trendMax = Math.max(1, ...trend.map(w => w.avg))
  const starKeys = [5, 4, 3, 2, 1]
  const starTotal = Object.values(data.starDist).reduce((s, v) => s + v, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderTop: '3px solid var(--amber)' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-3)', fontFamily: F, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Promedio global</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: F, fontSize: '1.6rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{overall.toFixed(1)}</span>
            <MiniStars avg={overall} size={13} />
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderTop: `3px solid ${BLUE}` }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-3)', fontFamily: F, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Respuestas</div>
          <div style={{ fontFamily: F, fontSize: '1.6rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{data.total}</div>
          <div style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', marginTop: 3 }}>{pctComment}% con comentario</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderTop: `3px solid ${trendDiff !== null && trendDiff >= 0 ? GREEN : '#ef4444'}` }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-3)', fontFamily: F, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Esta semana</div>
          <div style={{ fontFamily: F, fontSize: '1.6rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{lastWeek?.avg > 0 ? lastWeek.avg.toFixed(1) : '—'}</div>
          {trendDiff !== null && (
            <div style={{ fontFamily: F, fontSize: '0.68rem', color: trendDiff >= 0 ? GREEN : '#ef4444', marginTop: 3 }}>
              {trendDiff >= 0 ? '+' : ''}{trendDiff} vs semana anterior
            </div>
          )}
        </div>
      </div>

      {/* Tendencia semanal */}
      <Card>
        <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Tendencia — últimas 8 semanas</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {trend.map((w, i) => {
            const pct = w.avg > 0 ? Math.max(4, Math.round((w.avg / 5) * 100)) : 0
            const isLast = i === trend.length - 1
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '70%', height: `${pct}%`, background: isLast ? 'var(--amber)' : 'var(--amber-tint)', borderRadius: '4px 4px 0 0', minHeight: w.count > 0 ? 4 : 0 }}>
                    {w.avg > 0 && (
                      <span style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 2, fontFamily: F, fontSize: '0.58rem', fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{w.avg.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: F, fontSize: '0.56rem', color: 'var(--ink-3)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{w.label}</span>
                {w.count > 0 && <span style={{ fontFamily: F, fontSize: '0.52rem', color: 'var(--ink-3)' }}>{w.count}r</span>}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Por pregunta + distribución en fila */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {withData.length > 0 && (
          <Card style={{ flex: '2 1 240px', minWidth: 0 }}>
            <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Por pregunta</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {withData.map(a => (
                <div key={a.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: F, fontSize: '0.78rem', color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <MiniStars avg={a.avg} size={10} />
                      <span style={{ fontFamily: F, fontSize: '0.78rem', fontWeight: 800, color: 'var(--ink)', minWidth: 24, textAlign: 'right' }}>{a.avg.toFixed(1)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: 'var(--sunk)', overflow: 'hidden' }}>
                    <div style={{ width: `${(a.avg / 5) * 100}%`, height: '100%', background: a.avg >= 4 ? GREEN : a.avg >= 3 ? 'var(--amber)' : '#ef4444', borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Distribución ★ */}
        <Card style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontFamily: F, fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Distribución ★</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {starKeys.map(s => {
              const cnt = data.starDist[s] ?? 0
              const pct = starTotal > 0 ? Math.round((cnt / starTotal) * 100) : 0
              const isActive = filterStar === s
              return (
                <button key={s} onClick={() => setFilterStar(isActive ? null : s)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: F, fontSize: '0.72rem', fontWeight: 700, color: isActive ? 'var(--amber)' : 'var(--ink-2)', minWidth: 12 }}>{s}★</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--sunk)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: isActive ? 'var(--amber)' : 'var(--amber-tint)', borderRadius: 999 }} />
                    </div>
                    <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', minWidth: 28, textAlign: 'right' }}>{cnt}</span>
                  </div>
                </button>
              )
            })}
          </div>
          {filterStar !== null && (
            <button onClick={() => setFilterStar(null)} style={{ marginTop: 10, fontFamily: F, fontSize: '0.72rem', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-tint)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', width: '100%' }}>
              Ver todas
            </button>
          )}
        </Card>
      </div>

      {/* Feed de respuestas */}
      <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 6 }}>
        {filterStar !== null ? `Respuestas ${filterStar}★ — ${filtered.length}` : `Todas las respuestas — ${filtered.length}`}
      </div>

      {filtered.length === 0 && (
        <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.84rem' }}>Sin respuestas para este filtro.</p></Card>
      )}

      {filtered.slice(0, 100).map(resp => {
        const validVs = resp.answers.map(a => a.v).filter(v => v >= 1 && v <= 5)
        const avgResp = validVs.length > 0 ? validVs.reduce((s, v) => s + v, 0) / validVs.length : null
        const dateStr = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(resp.createdAt))
        const initials = (resp.customerName || '?').trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
        const orderTypeLabel = resp.orderType === 'delivery' ? 'Delivery' : resp.orderType === 'pickup' ? 'Retiro' : resp.orderType === 'dine-in' ? 'Mesa' : null

        return (
          <Card key={resp.id} style={{ padding: '14px 16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: avgResp !== null && avgResp >= 4 ? 'var(--jade-tint)' : avgResp !== null && avgResp >= 3 ? 'var(--amber-tint)' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: F, fontSize: '0.75rem', fontWeight: 800, color: avgResp !== null && avgResp >= 4 ? 'var(--jade)' : avgResp !== null && avgResp >= 3 ? 'var(--amber)' : '#ef4444' }}>{initials}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: F, fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)' }}>{resp.customerName || 'Sin nombre'}</span>
                  {resp.customerPhone && <span style={{ fontFamily: F, fontSize: '0.72rem', color: 'var(--ink-3)' }}>{resp.customerPhone}</span>}
                  {avgResp !== null && <MiniStars avg={avgResp} size={12} />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{dateStr}</span>
                  {resp.orderNumber && <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>· Pedido #{resp.orderNumber}</span>}
                  {orderTypeLabel && <span style={{ fontFamily: F, fontSize: '0.65rem', fontWeight: 700, color: BLUE, background: `${BLUE}18`, padding: '1px 7px', borderRadius: 999 }}>{orderTypeLabel}</span>}
                  {resp.orderTotal && <span style={{ fontFamily: F, fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-2)' }}>{clp(resp.orderTotal)}</span>}
                </div>
              </div>
            </div>

            {/* Lo que pidió */}
            {resp.orderItems.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {resp.orderItems.map((item, i) => (
                  <span key={i} style={{ fontFamily: F, fontSize: '0.7rem', color: 'var(--ink-2)', background: 'var(--sunk)', borderRadius: 8, padding: '3px 10px' }}>{item}</span>
                ))}
              </div>
            )}

            {/* Ratings por pregunta */}
            {resp.answers.filter(a => a.v >= 1 && a.v <= 5).length > 1 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: resp.comment ? 10 : 0 }}>
                {resp.answers.filter(a => a.v >= 1 && a.v <= 5).map(a => (
                  <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: F, fontSize: '0.6rem', color: 'var(--ink-3)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 100 }}>{a.text}</span>
                    <MiniStars avg={a.v} size={10} />
                  </div>
                ))}
              </div>
            )}

            {/* Comentario */}
            {resp.comment && (
              <div style={{ background: 'var(--sunk)', borderRadius: 10, padding: '8px 12px', borderLeft: '3px solid var(--amber)' }}>
                <span style={{ fontFamily: F, fontSize: '0.78rem', color: 'var(--ink)', fontStyle: 'italic' }}>"{resp.comment}"</span>
              </div>
            )}
          </Card>
        )
      })}

      {filtered.length > 100 && (
        <p style={{ fontFamily: F, fontSize: '0.74rem', color: 'var(--ink-3)', textAlign: 'center', margin: '4px 0' }}>Mostrando 100 de {filtered.length}</p>
      )}
    </div>
  )
}

type ReportSubSection = 'dashboard' | 'delivery' | 'platos' | 'clientes' | 'comportamiento' | 'satisfaccion'

const SUB_SECTIONS: { id: ReportSubSection; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Resumen',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
        <rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      </svg>
    ),
  },
  {
    id: 'platos',
    label: 'Platos',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/>
      </svg>
    ),
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
      </svg>
    ),
  },
  {
    id: 'comportamiento',
    label: 'Comportamiento',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'satisfaccion',
    label: 'Satisfacción',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
]

export default function PosReportesPanel({ restaurantId, allBranches }: { restaurantId: string; title?: string; onDone?: () => void; allBranches?: BranchInfo[] }) {
  const [subSection, setSubSection] = useState<ReportSubSection>('dashboard')
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [heatPoints, setHeatPoints] = useState<HeatPt[]>([])
  const [chartView, setChartView] = useState<'hora' | 'semana' | 'mes' | 'año'>('hora')
  const [chartSelectedDate, setChartSelectedDate] = useState<string | null>(null)
  const today = chileTodayLocal()
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)

  const fetchReport = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true); setData(null)
    try {
      if (allBranches && allBranches.length > 1) {
        const results = await Promise.all(
          allBranches.map(b =>
            fetch(`/api/panel/ecommerce/pos-orders/report?restaurantId=${b.id}&from=${fromDate}&to=${toDate}`)
              .then(r => r.ok ? r.json() : null).catch(() => null)
          )
        )
        const valid = results.filter(Boolean) as Report[]
        if (valid.length > 0) {
          setData({
            ordersCount: valid.reduce((s, r) => s + r.ordersCount, 0),
            productSales: valid.reduce((s, r) => s + r.productSales, 0),
            deliveryTotal: valid.reduce((s, r) => s + r.deliveryTotal, 0),
            tipsTotal: valid.reduce((s, r) => s + r.tipsTotal, 0),
            grossTotal: valid.reduce((s, r) => s + r.grossTotal, 0),
            hourly: mergeByKey(valid.flatMap(r => r.hourly), 'hour', ['sales', 'orders']).sort((a, b) => a.hour - b.hour),
            channels: mergeByKey(valid.flatMap(r => r.channels), 'name', ['sales', 'orders']),
            products: mergeByKey(valid.flatMap(r => r.products), 'name', ['qty', 'revenue']).sort((a, b) => b.qty - a.qty),
            byType: mergeByKey(valid.flatMap(r => r.byType), 'type', ['sales', 'orders']).map(x => ({ ...x, label: valid[0].byType.find((t: TypeBucket) => t.type === x.type)?.label ?? x.type })),
            monthly: { month: valid[0].monthly.month, days: mergeByKey(valid.flatMap(r => r.monthly.days), 'day', ['sales', 'orders']).sort((a, b) => a.day - b.day) },
            byMonth: mergeByKey(valid.flatMap(r => r.byMonth ?? []), 'ym', ['sales', 'orders']).sort((a: any, b: any) => a.ym.localeCompare(b.ym)),
            byYear: mergeByKey(valid.flatMap(r => r.byYear ?? []), 'yr', ['sales', 'orders']).sort((a: any, b: any) => a.yr.localeCompare(b.yr)),
            deliveryTimes: (() => {
              const allOrders = valid.flatMap(r => r.deliveryTimes?.orders ?? []).sort((a, b) => {
                if (a.totalMin == null && b.totalMin == null) return 0
                if (a.totalMin == null) return 1
                if (b.totalMin == null) return -1
                return a.totalMin - b.totalMin
              })
              const n = allOrders.length
              if (n === 0) return { count: 0, avgTotal: null, avgPrep: null, avgTransit: null, pctUnder30: null, pctUnder45: null, pctUnder60: null, orders: [] }
              const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null
              const completed = allOrders.filter(o => o.totalMin != null)
              const c = completed.length
              return {
                count: n,
                avgTotal: avg(completed.map(o => o.totalMin!)),
                avgPrep: avg(allOrders.filter(o => o.prepMin != null).map(o => o.prepMin!)),
                avgTransit: avg(allOrders.filter(o => o.transitMin != null).map(o => o.transitMin!)),
                pctUnder30: c > 0 ? Math.round((completed.filter(o => o.totalMin! <= 30).length / c) * 100) : null,
                pctUnder45: c > 0 ? Math.round((completed.filter(o => o.totalMin! <= 45).length / c) * 100) : null,
                pctUnder60: c > 0 ? Math.round((completed.filter(o => o.totalMin! <= 60).length / c) * 100) : null,
                orders: allOrders,
              }
            })(),
          })
        }
      } else {
        const r = await fetch(`/api/panel/ecommerce/pos-orders/report?restaurantId=${restaurantId}&from=${fromDate}&to=${toDate}`)
        const d = await r.json()
        if (r.ok) setData(d)
      }
      // Coordenadas para el mapa de calor (pedidos delivery con lat/lng)
      const branches = allBranches && allBranches.length > 1 ? allBranches : [{ id: restaurantId }]
      const heatResults = await Promise.all(
        branches.map(b =>
          fetch(`/api/panel/ecommerce/pos-orders/delivery-locations?restaurantId=${b.id}&from=${fromDate}&to=${toDate}`)
            .then(r => r.ok ? r.json() : { points: [] }).catch(() => ({ points: [] }))
        )
      )
      setHeatPoints(heatResults.flatMap((r: { points: HeatPt[] }) => r.points))
    } catch { /* noop */ }
    setLoading(false)
  }, [restaurantId, fromDate, toDate, allBranches])

  useEffect(() => { fetchReport() }, [fetchReport])

  const singleDay = fromDate === toDate
  const shiftBoth = (days: number) => {
    setFromDate(f => addDaysYmd(f, days))
    setToDate(t => addDaysYmd(t, days))
  }

  return (
    <div className="pos-scroll">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '20px 16px 48px' }}>

        {/* Sub-section tabs */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div className="pos-report-tabs" style={{ display: 'flex', gap: 4, background: 'var(--sunk)', borderRadius: 12, padding: 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <style>{`.pos-report-tabs::-webkit-scrollbar{display:none}`}</style>
            {SUB_SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSubSection(s.id)}
                style={{
                  flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '10px 15px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontFamily: F, fontSize: '0.82rem', fontWeight: 700, transition: '.15s', whiteSpace: 'nowrap',
                  background: subSection === s.id ? 'var(--surface)' : 'transparent',
                  color: subSection === s.id ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: subSection === s.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                }}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
          {/* Right-edge fade to hint at horizontal scrollability */}
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, borderRadius: '0 12px 12px 0', background: 'linear-gradient(to right, transparent, var(--sunk))', pointerEvents: 'none' }} />
        </div>

        {/* Platos sub-section */}
        {subSection === 'platos' && (
          <>
            <DateRangePicker fromDate={fromDate} toDate={toDate} today={today}
              onFromChange={v => { setFromDate(v); if (v > toDate) setToDate(v) }}
              onToChange={v => { setToDate(v); if (v < fromDate) setFromDate(v) }}
              onShift={shiftBoth} onReset={() => { setFromDate(today); setToDate(today) }}
              onRefresh={fetchReport} />
            <PlatosSection
              restaurantId={restaurantId}
              fromDate={fromDate}
              toDate={toDate}
              products={data?.products ?? []}
              loading={loading}
            />
          </>
        )}

        {/* Clientes sub-section */}
        {subSection === 'clientes' && (
          <ClientsSection restaurantId={restaurantId} />
        )}

        {/* Satisfacción sub-section */}
        {subSection === 'satisfaccion' && (
          <SatisfaccionTabSection restaurantId={restaurantId} />
        )}

        {/* Comportamiento sub-section */}
        {subSection === 'comportamiento' && (
          <>
            <DateRangePicker fromDate={fromDate} toDate={toDate} today={today}
              onFromChange={v => { setFromDate(v); if (v > toDate) setToDate(v) }}
              onToChange={v => { setToDate(v); if (v < fromDate) setFromDate(v) }}
              onShift={shiftBoth} onReset={() => { setFromDate(today); setToDate(today) }} />
            <StoreEventsPanel restaurantId={restaurantId} fromDate={fromDate} toDate={toDate} />
          </>
        )}

        {/* Delivery sub-section */}
        {subSection === 'delivery' && (
          <>
            <DateRangePicker fromDate={fromDate} toDate={toDate} today={today}
              onFromChange={v => { setFromDate(v); if (v > toDate) setToDate(v) }}
              onToChange={v => { setToDate(v); if (v < fromDate) setFromDate(v) }}
              onShift={shiftBoth} onReset={() => { setFromDate(today); setToDate(today) }}
              onRefresh={fetchReport} />
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Cargando…
              </div>
            ) : !data ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: F, color: 'var(--ink-3)', fontSize: '0.84rem' }}>No se pudo cargar el reporte.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.deliveryTimes ? (
                  <>
                    <DeliveryCostChart
                      orders={data.deliveryTimes.orders}
                      selectedDate={chartSelectedDate}
                      onDateClick={d => setChartSelectedDate(d || null)}
                    />
                    <SectionLabel>Tiempos de entrega</SectionLabel>
                    <DeliveryTimesSection
                      dt={data.deliveryTimes}
                      restaurantId={restaurantId}
                      selectedDate={chartSelectedDate}
                      onDateClick={d => setChartSelectedDate(d || null)}
                    />
                  </>
                ) : (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                    <p style={{ fontFamily: F, color: 'var(--ink-3)', fontSize: '0.84rem' }}>Sin pedidos delivery en el período.</p>
                  </div>
                )}
                {heatPoints.length > 0 && (
                  <>
                    <SectionLabel>Dónde salen los pedidos</SectionLabel>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: F, marginBottom: 10 }}>
                        {heatPoints.length} pedido{heatPoints.length !== 1 ? 's' : ''} con ubicación
                      </div>
                      <DeliveryHeatmap points={heatPoints} />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Dashboard sub-section */}
        {subSection === 'dashboard' && <>

        <DateRangePicker fromDate={fromDate} toDate={toDate} today={today}
          onFromChange={v => { setFromDate(v); if (v > toDate) setToDate(v) }}
          onToChange={v => { setToDate(v); if (v < fromDate) setFromDate(v) }}
          onShift={shiftBoth} onReset={() => { setFromDate(today); setToDate(today) }}
          onRefresh={fetchReport} />

        {allBranches && allBranches.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ padding: '4px 12px', borderRadius: 999, background: 'var(--amber-tint-2)', border: '1px solid var(--amber)', color: 'var(--amber-press)', fontSize: 12, fontWeight: 700, fontFamily: F }}>
              Todas las sucursales · {allBranches.length}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Cargando reporte…
          </div>
        ) : !data ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: F, color: 'var(--ink-3)', fontSize: '0.84rem' }}>No se pudo cargar el reporte.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* KPIs */}
            <SectionLabel>{singleDay ? 'Resumen del día' : 'Resumen del período'}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 4 }}>
              <Stat label={singleDay ? 'Venta del día' : 'Venta del período'} value={clp(data.productSales)} hint="Productos con IVA" color={GREEN} big span={2} />
              <Stat label="Pedidos" value={data.ordersCount.toLocaleString('es-CL')} color={'var(--amber)'} />
              <Stat label="Ticket promedio" value={clp(data.ordersCount > 0 ? data.productSales / data.ordersCount : 0)} hint="Por pedido" color={BLUE} />
              <Stat label="Delivery" value={clp(data.deliveryTotal)} hint="Total cobrado" color={BLUE} />
              <Stat label="Propinas" value={clp(data.tipsTotal)} hint={data.tipsStats ? `${data.tipsStats.pctWithTip}% de pedidos · prom. ${clp(data.tipsStats.avgPerOrder)}` : undefined} color={PURPLE} />
              {data.cancellations && data.cancellations.count > 0 && (
                <Stat label="Cancelados" value={data.cancellations.count.toString()} hint={`${data.cancellations.rate}% de tasa`} color="#ef4444" />
              )}
            </div>

            {/* Canal + Tipo */}
            <SectionLabel>Desglose</SectionLabel>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <ChannelBreakdown channels={data.channels} total={data.productSales} />
              <OrderTypePie byType={data.byType} />
            </div>

            {/* Métodos de pago */}
            {data.paymentMethods && data.paymentMethods.length > 0 && (
              <>
                <SectionLabel>Métodos de pago</SectionLabel>
                <PaymentMethodsSection methods={data.paymentMethods} total={data.productSales} />
              </>
            )}

            {/* Gráficos por período — pills selector */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {(['hora', 'semana', 'mes', 'año'] as const).map(v => (
                  <button key={v} onClick={() => {
                    // Auto-expand date range when switching to multi-period views
                    if (v === 'mes' && fromDate === toDate) {
                      const yr = fromDate.slice(0, 4)
                      setFromDate(`${yr}-01-01`)
                      setToDate(yr === today.slice(0, 4) ? today : `${yr}-12-31`)
                    } else if (v === 'año' && fromDate === toDate) {
                      const yr = fromDate.slice(0, 4)
                      setFromDate(`${yr}-01-01`)
                      setToDate(yr === today.slice(0, 4) ? today : `${yr}-12-31`)
                    }
                    setChartView(v)
                  }} style={{
                    fontFamily: F, fontSize: '0.78rem', fontWeight: 700,
                    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--line)',
                    cursor: 'pointer', transition: '.12s',
                    background: chartView === v ? 'var(--ink)' : 'var(--surface)',
                    color: chartView === v ? 'var(--surface)' : 'var(--ink-2)',
                  }}>
                    {v === 'hora' ? 'Por hora' : v === 'semana' ? 'Por semana' : v === 'mes' ? 'Por mes' : 'Por año'}
                  </button>
                ))}
              </div>

              {chartView === 'hora' && <HourlyChart hourly={data.hourly} />}

              {chartView === 'semana' && (
                data.dowStats && data.dowStats.some((d: DowStat) => d.count > 0)
                  ? <DowStatsChart stats={data.dowStats as DowStat[]} />
                  : <Card><p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 0', fontSize: '0.82rem' }}>Sin datos suficientes por día de semana.</p></Card>
              )}

              {chartView === 'mes' && <ByMonthChart data={data.byMonth ?? []} />}

              {chartView === 'año' && <ByYearChart data={data.byYear ?? []} />}
            </div>

            {/* Ranking */}
            <SectionLabel>Productos</SectionLabel>
            <ProductRanking products={data.products} />

            {/* Cancelaciones */}
            {data.cancellations && data.cancellations.count > 0 && (
              <>
                <SectionLabel>Cancelaciones</SectionLabel>
                <CancellationsSection data={data.cancellations} />
              </>
            )}

            {/* Satisfacción */}
            <SectionLabel>Satisfacción</SectionLabel>
            <SatisfaccionSection restaurantId={restaurantId} />

          </div>
        )}

        </>}{/* /dashboard */}

      </div>
    </div>
  )
}
