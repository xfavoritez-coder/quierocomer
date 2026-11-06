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
interface Report {
  ordersCount: number
  productSales: number
  deliveryTotal: number
  tipsTotal: number
  grossTotal: number
  hourly: HourBucket[]
  channels: Channel[]
  products: ProductRank[]
  byType: TypeBucket[]
  monthly: { month: string; days: MonthlyDay[] }
  deliveryTimes?: DeliveryTimes
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
    <div style={{ fontFamily: F, fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
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

function DeliveryTimesSection({ dt, restaurantId }: { dt: DeliveryTimes; restaurantId: string }) {
  const [selected, setSelected] = useState<DeliveryTimeRow | null>(null)
  if (dt.count === 0) return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Tiempos de entrega</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>Delivery</span>
      </div>
      <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>Sin entregas completadas en el período.</p>
    </Card>
  )

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Tiempos de entrega</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>
          {dt.orders.filter((o: any) => o.totalMin != null).length} de {dt.count} entregados
        </span>
      </div>

      {/* KPI summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Promedio total', value: minLabel(dt.avgTotal), color: dt.avgTotal != null ? timeColor(dt.avgTotal) : 'var(--ink-3)' },
          { label: 'Preparación', value: minLabel(dt.avgPrep), color: BLUE },
          { label: 'En tránsito', value: minLabel(dt.avgTransit), color: PURPLE },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--sunk)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: F, fontSize: '1.1rem', fontWeight: 900, color: 'var(--ink)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* % bajo umbral */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {([['≤30 min', dt.pctUnder30, GREEN], ['≤45 min', dt.pctUnder45, BLUE], ['≤60 min', dt.pctUnder60, 'var(--amber)']] as [string, number | null, string][]).map(([label, pct, color]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: F, fontSize: '0.74rem', fontWeight: 700, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {pct ?? '—'}% {label}
          </span>
        ))}
      </div>

      {/* Tabla por pedido */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px 52px 56px', gap: 8, padding: '4px 6px', marginBottom: 2 }}>
          <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Pedido</span>
          <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'right' }}>Prep.</span>
          <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'right' }}>Tránsito</span>
          <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'right' }}>Total</span>
          <span style={{ fontFamily: F, fontSize: '0.64rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'right' }}>Delivery</span>
        </div>
        {dt.orders.map((o, i) => (
          <div key={i} onClick={() => setSelected(o)} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px 52px 56px', gap: 8, padding: '6px 6px', borderRadius: 8, background: i % 2 === 0 ? 'transparent' : 'var(--sunk)', cursor: 'pointer' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {o.ref ? `#${o.ref}` : '—'}
              </span>
              {o.name && <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{o.name}</span>}
            </div>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', alignSelf: 'center' }}>{o.prepMin != null ? `${o.prepMin}m` : '—'}</span>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', alignSelf: 'center' }}>{o.transitMin != null ? `${o.transitMin}m` : '—'}</span>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 800, color: o.totalMin != null ? timeColor(o.totalMin) : 'var(--ink-3)', textAlign: 'right', alignSelf: 'center' }}>{o.totalMin != null ? `${o.totalMin}m` : '—'}</span>
            <span style={{ fontFamily: F, fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)', textAlign: 'right', alignSelf: 'center' }}>{o.deliveryFee > 0 ? clp(o.deliveryFee) : '—'}</span>
          </div>
        ))}
      </div>

      {selected && <DeliveryOrderModal order={selected} restaurantId={restaurantId} onClose={() => setSelected(null)} />}
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

type ClientSortKey = 'riskScore' | 'totalSpent' | 'orders' | 'lastOrderAt' | 'avgFrequencyDays'

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

  if (clLoading) return <Card><div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontFamily: F, fontSize: '0.84rem' }}>Cargando clientes…</div></Card>
  if (!cd) return null

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Clientes</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{cd.total} únicos</span>
      </div>

      {/* Resumen por estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {(['active', 'at_risk', 'churned', 'new'] as ClientStatus[]).map(s => (
          <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
            style={{ background: filterStatus === s ? STATUS_BG[s] : 'var(--sunk)', border: `1.5px solid ${filterStatus === s ? STATUS_COLOR[s] : 'var(--line)'}`, borderRadius: 12, padding: '10px 8px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontFamily: F, fontSize: '1.1rem', fontWeight: 900, color: STATUS_COLOR[s] }}>{cd.byStatus[s]}</div>
            <div style={{ fontFamily: F, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 2 }}>{STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>

      {/* Buscador */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre, email o teléfono…"
        style={{ width: '100%', boxSizing: 'border-box', fontFamily: F, fontSize: '0.82rem', padding: '8px 12px', background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', marginBottom: 14, outline: 'none' }}
      />

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
                {/* Nombre/email */}
                <td style={{ padding: '8px 6px 8px 0', maxWidth: 160, overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || c.phone}</div>
                </td>
                {/* Pedidos */}
                <td style={{ padding: '8px 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.orders}</td>
                {/* Gastado */}
                <td style={{ padding: '8px 6px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap' }}>{clp(c.totalSpent)}</td>
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
  )
}

export default function PosReportesPanel({ restaurantId, allBranches }: { restaurantId: string; title?: string; onDone?: () => void; allBranches?: BranchInfo[] }) {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [heatPoints, setHeatPoints] = useState<HeatPt[]>([])
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

  const inputSt: React.CSSProperties = {
    fontFamily: F, fontSize: '0.82rem', color: 'var(--ink)',
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
  }
  const navBtn: React.CSSProperties = {
    width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)',
    color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div className="pos-scroll">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '20px 16px 48px' }}>

        {/* Date picker */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {singleDay && (
            <button onClick={() => shiftBoth(-1)} style={navBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <input type="date" value={fromDate} max={toDate} onChange={e => { const v = e.target.value || today; setFromDate(v); if (v > toDate) setToDate(v) }} style={inputSt} />
          <span style={{ fontFamily: F, fontSize: '0.8rem', color: 'var(--ink-3)' }}>→</span>
          <input type="date" value={toDate} min={fromDate} onChange={e => { const v = e.target.value || today; setToDate(v); if (v < fromDate) setFromDate(v) }} style={inputSt} />
          {singleDay && (
            <button onClick={() => shiftBoth(1)} disabled={fromDate >= today} style={{ ...navBtn, opacity: fromDate >= today ? 0.4 : 1, cursor: fromDate >= today ? 'default' : 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {(fromDate !== today || toDate !== today) && (
            <button onClick={() => { setFromDate(today); setToDate(today) }} style={{ fontFamily: F, fontSize: '0.74rem', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-tint)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Hoy</button>
          )}
          <button onClick={fetchReport} style={{ marginLeft: 'auto', ...navBtn }} title="Actualizar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>

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
              <Stat label="Propinas" value={clp(data.tipsTotal)} color={PURPLE} />
            </div>

            {/* Canal + Tipo */}
            <SectionLabel>Desglose</SectionLabel>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <ChannelBreakdown channels={data.channels} total={data.productSales} />
              <OrderTypePie byType={data.byType} />
            </div>

            {/* Venta por hora */}
            <SectionLabel>Horarios</SectionLabel>
            <HourlyChart hourly={data.hourly} />

            {/* Venta del mes */}
            <SectionLabel>Mes en curso</SectionLabel>
            <MonthlyChart monthly={data.monthly} />

            {/* Ranking */}
            <SectionLabel>Productos</SectionLabel>
            <ProductRanking products={data.products} />

            {/* Tiempos de entrega */}
            {data.deliveryTimes && (
              <>
                <SectionLabel>Delivery</SectionLabel>
                <DeliveryTimesSection dt={data.deliveryTimes} restaurantId={restaurantId} />
              </>
            )}

            {/* Mapa de calor de pedidos delivery */}
            {heatPoints.length > 0 && (
              <>
                <SectionLabel>Dónde salen los pedidos</SectionLabel>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: F, marginBottom: 10 }}>
                    {heatPoints.length} pedido{heatPoints.length !== 1 ? 's' : ''} con ubicación — las zonas más calientes concentran más pedidos
                  </div>
                  <DeliveryHeatmap points={heatPoints} />
                </div>
              </>
            )}

            {/* Clientes */}
            <SectionLabel>Clientes</SectionLabel>
            <ClientsSection restaurantId={restaurantId} />

            {/* Comportamiento de usuarios (store events) */}
            <SectionLabel>Comportamiento de usuarios</SectionLabel>
            <StoreEventsPanel restaurantId={restaurantId} fromDate={fromDate} toDate={toDate} />

          </div>
        )}
      </div>
    </div>
  )
}
