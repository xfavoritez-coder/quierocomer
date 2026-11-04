'use client'

import { useState, useEffect, useCallback } from 'react'

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

function Stat({ label, value, hint, color, big }: { label: string; value: string; hint?: string; color: string; big?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-3)', fontFamily: F, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: big ? '1.6rem' : '1.3rem', fontWeight: 900, color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
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

function ProductRanking({ products }: { products: ProductRank[] }) {
  const maxQty = Math.max(1, ...products.map(p => p.qty))
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>Productos más vendidos</span>
        <span style={{ fontFamily: F, fontSize: '0.68rem', color: 'var(--ink-3)' }}>{products.length} · por cantidad</span>
      </div>
      {products.length === 0 ? (
        <p style={{ fontFamily: F, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0', fontSize: '0.82rem' }}>Sin ventas en el período.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.map((p, i) => {
            const pct = Math.max(4, Math.round((p.qty / maxQty) * 100))
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: i < 3 ? 'var(--amber-tint)' : 'var(--sunk)', color: i < 3 ? 'var(--amber)' : 'var(--ink-3)', fontFamily: F, fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <span style={{ minWidth: 0, fontFamily: F, fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ flexShrink: 0, fontFamily: F, fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)' }}>{p.qty}<span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--ink-3)' }}> u.{p.revenue > 0 ? ` · ${clp(p.revenue)}` : ''}</span></span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--amber)', borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
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

export default function PosReportesPanel({ restaurantId, allBranches }: { restaurantId: string; title?: string; onDone?: () => void; allBranches?: BranchInfo[] }) {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
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
            products: mergeByKey(valid.flatMap(r => r.products), 'name', ['qty', 'revenue']).sort((a, b) => b.revenue - a.revenue),
            byType: mergeByKey(valid.flatMap(r => r.byType), 'type', ['sales', 'orders']).map(x => ({ ...x, label: valid[0].byType.find((t: TypeBucket) => t.type === x.type)?.label ?? x.type })),
            monthly: { month: valid[0].monthly.month, days: mergeByKey(valid.flatMap(r => r.monthly.days), 'day', ['sales', 'orders']).sort((a, b) => a.day - b.day) },
          })
        }
      } else {
        const r = await fetch(`/api/panel/ecommerce/pos-orders/report?restaurantId=${restaurantId}&from=${fromDate}&to=${toDate}`)
        const d = await r.json()
        if (r.ok) setData(d)
      }
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
              <Stat label={singleDay ? 'Venta del día' : 'Venta del período'} value={clp(data.productSales)} hint="Productos con IVA" color={GREEN} big />
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

          </div>
        )}
      </div>
    </div>
  )
}
