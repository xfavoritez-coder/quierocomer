'use client'

import { useEffect, useState, useRef } from 'react'
import { useIsDesktop } from '../../lib/useIsDesktop'
import { fmtElapsed } from '../OrderClock'
import { deliveryPlatformLabel } from '@/lib/pos'
import PastOrderDetail from '../PastOrderDetail'
import type { PastOrder } from '../PastOrderDetail'

const F = 'var(--sans)'

function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function startOfWeekYmd(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`); const dow = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7)); return d.toISOString().slice(0, 10)
}
function startOfMonthYmd(ymd: string): string { return `${ymd.slice(0, 7)}-01` }

const DATE_PRESETS = (today: string) => {
  const ayer = addDaysYmd(today, -1)
  const semStart = startOfWeekYmd(today)
  const semPasadaFin = addDaysYmd(semStart, -1)
  const semPasadaIni = startOfWeekYmd(semPasadaFin)
  const mesIni = startOfMonthYmd(today)
  return [
    { id: 'hoy',       label: 'Hoy',         from: today,        to: today },
    { id: 'ayer',      label: 'Ayer',         from: ayer,         to: ayer },
    { id: 'semana',    label: 'Esta semana',  from: semStart,     to: today },
    { id: 'sem_past',  label: 'Sem. pasada',  from: semPasadaIni, to: semPasadaFin },
    { id: 'mes',       label: 'Este mes',     from: mesIni,       to: today },
  ]
}

function DateRangePicker({ fromDate, toDate, today, onFromChange, onToChange, onRange }: {
  fromDate: string; toDate: string; today: string
  onFromChange: (v: string) => void; onToChange: (v: string) => void
  onRange: (from: string, to: string) => void
}) {
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const presets = DATE_PRESETS(today)
  const activePreset = presets.find(p => p.from === fromDate && p.to === toDate) ?? null

  useEffect(() => {
    if (!dropOpen) return
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropOpen])

  const fmtDate = (ymd: string) =>
    new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' })
      .format(new Date(ymd + 'T12:00:00Z')).replace('.', '')

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '8px 10px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="pos-date-box" style={{ position: 'relative', flex: '1 1 0' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style={{ fontFamily: F, fontSize: '0.82rem', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{fmtDate(fromDate)}</span>
          <input type="date" value={fromDate} max={toDate} onChange={e => onFromChange(e.target.value || today)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} tabIndex={-1} />
        </div>
        <span style={{ fontFamily: F, fontSize: '0.75rem', color: 'var(--ink-4)', flexShrink: 0 }}>→</span>
        <div className="pos-date-box" style={{ position: 'relative', flex: '1 1 0' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style={{ fontFamily: F, fontSize: '0.82rem', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{fmtDate(toDate)}</span>
          <input type="date" value={toDate} min={fromDate} onChange={e => onToChange(e.target.value || today)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
      </div>
      <div ref={dropRef} className="pos-date-preset" style={{ position: 'relative' }}>
        <button
          onClick={() => setDropOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: F, fontSize: '0.82rem', fontWeight: 600,
            color: 'var(--ink-2)',
            background: 'rgba(222,124,0,.06)',
            border: '1px solid rgba(222,124,0,.22)',
            borderRadius: 20, padding: '5px 10px 5px 8px', cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {activePreset?.label ?? 'Rango'}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {dropOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.10)',
            minWidth: 148, padding: '4px 0', overflow: 'hidden',
          }}>
            {presets.map(p => {
              const active = activePreset?.id === p.id
              return (
                <button key={p.id} onClick={() => { onRange(p.from, p.to); setDropOpen(false) }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  fontFamily: F, fontSize: '0.82rem', fontWeight: active ? 700 : 400,
                  color: 'var(--ink)',
                  background: active ? 'var(--sunk)' : 'transparent',
                  border: 'none', padding: '8px 14px', cursor: 'pointer',
                }}>{p.label}</button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Origen del pedido (por dónde entró): plataforma de delivery, Uber Eats directo,
// Toteat, tienda ecommerce o tomado a mano en el POS.
function sourceTag(o: { provider?: string | null; vendorName?: string | null }): { label: string; color: string } {
  const vn = o.vendorName || ''
  const plat = deliveryPlatformLabel(vn) // Uber Eats, PedidosYa, Rappi, Didi, Justo
  if (plat) return { label: plat, color: plat === 'Uber Eats' ? '#0f0f0f' : plat === 'PedidosYa' ? '#e11d48' : plat === 'Rappi' ? '#ff4f00' : '#6366f1' }
  if (o.provider === 'ubereats') return { label: 'Uber Eats', color: '#0f0f0f' }
  if (o.provider === 'toteat') return { label: 'Toteat', color: '#ea580c' }
  // Espejo del ecommerce: "-Web" = tienda pública; sin sufijo = tomado en el POS.
  if (/-web$/i.test(vn)) return { label: 'Ecommerce', color: '#0d9488' }
  return { label: 'Manual', color: '#2563eb' }
}

interface HistorialOrder {
  id: string
  dailyNumber?: number | null
  orderReference?: string | null
  customerName: string
  customerPhone: string
  addressLine: string
  saleType: string
  isDelivery: boolean
  provider?: string | null
  vendorName?: string | null
  opsStage: string
  posStatus: string
  totalAmount: number
  paidAmount: number
  deliveryFee: number
  items: unknown
  createdAt: string
  opsReadyForDeliveryAt?: string | null
  opsDispatchedAt?: string | null
  opsDeliveredAt?: string | null
  completedAt?: string | null
  updatedAt?: string | null
  rawPayload?: unknown
  _branchName?: string
}

// Tiempo total (congelado) que tomó el pedido. En retiro el tiempo se detiene
// cuando queda "listo" (el cliente lo pasa a buscar cuando quiere); en el resto,
// cuando se entrega/finaliza. null si no hay un cierre válido.
function frozenElapsedMs(o: HistorialOrder): number | null {
  const isDelivery = o.isDelivery || o.saleType === 'delivery'
  const isDineIn = !isDelivery && (o.saleType === 'dine-in' || o.saleType === 'dinein')
  const isRetiro = !isDelivery && !isDineIn
  const end = isRetiro
    ? (o.opsReadyForDeliveryAt || o.opsDeliveredAt || o.completedAt || o.updatedAt)
    : (o.opsDeliveredAt || o.completedAt || o.updatedAt)
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(o.createdAt).getTime()
  return ms >= 0 ? ms : null
}

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')
const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
const displayName = (s: string) => {
  const m = s.trim().match(/^(Venta\s+)?[Rr][aá]pida\s+#(\d+)$/i)
  if (m) return `Venta rápida #${m[2]}`
  return toName(s)
}

function cleanAddr(addr: string): string {
  return addr.replace(/,?\s*chile\b/gi, '').replace(/\s{2,}/g, ' ').replace(/,\s*$/g, '').trim()
}

function chip(color: string): React.CSSProperties {
  return {
    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '3px 6px', borderRadius: 5,
    background: color + '20', color,
  }
}

function itemLines(items: unknown): { name: string; qty: number; price: number }[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>
    const qty = Number(o.quantity ?? o.qty ?? o.cantidad ?? 1) || 1
    let price = 0
    if (Number(o.unitPriceAfterTax) > 0) price = Number(o.unitPriceAfterTax)
    else if (Number(o.unitPrice) > 0) price = Number(o.unitPrice)
    else if (Number(o.unit_price) > 0) price = Number(o.unit_price)
    else if (Number(o.price) > 0) price = Number(o.price)
    else if (Number(o.precio) > 0) price = Number(o.precio)
    else if (Number(o.amountAfterTax) > 0) price = Math.round(Number(o.amountAfterTax) / qty)
    else if (Number(o.netPrice) > 0) price = Math.round(Number(o.netPrice) / qty)
    else if (Number(o.unitTotal) > 0) price = Number(o.unitTotal)
    else if (Number(o.amount) > 0) price = Math.round(Number(o.amount) / qty)
    else if (Number(o.total) > 0) price = Math.round(Number(o.total) / qty)
    return {
      name: String(o.name ?? o.productName ?? o.title ?? o.description ?? 'Ítem'),
      qty, price,
    }
  })
}

function fmt(d: string): string {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function diffMin(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

function OrderTimeline({ order }: { order: HistorialOrder }) {
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const canceled = order.posStatus === 'canceled'

  type Step = { label: string; ts: string | null | undefined; color: string }
  const steps: Step[] = [
    { label: 'Recibido', ts: order.createdAt, color: 'var(--ink-3)' },
    { label: 'Listo', ts: order.opsReadyForDeliveryAt, color: 'var(--jade)' },
    ...(isDelivery ? [{ label: 'En camino', ts: order.opsDispatchedAt, color: 'var(--amber)' }] : []),
    canceled
      ? { label: 'Anulado', ts: order.updatedAt, color: '#ef4444' }
      : { label: isDelivery ? 'Entregado' : 'Completado', ts: order.opsDeliveredAt ?? order.completedAt, color: 'var(--jade)' },
  ]
  const active = steps.filter(s => s.ts)
  if (active.length < 2) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {active.map((step, i) => {
        const prev = i > 0 ? active[i - 1] : null
        const delta = prev ? diffMin(prev.ts!, step.ts!) : null
        const isLast = i === active.length - 1
        return (
          <div key={step.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* Línea vertical + dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: step.color, flexShrink: 0, marginTop: 4 }} />
              {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--line)', minHeight: 20, margin: '3px 0' }} />}
            </div>
            {/* Contenido */}
            <div style={{ paddingBottom: isLast ? 0 : 14, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{step.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{fmt(step.ts!)}</span>
                {delta !== null && delta >= 0 && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)', marginLeft: 2 }}>+{delta} min</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Order card ────────────────────────────────────────────────────────
function HistorialCard({ order, isSelected, onSelect, showBranch }: { order: HistorialOrder; isSelected: boolean; onSelect: () => void; showBranch?: boolean }) {
  const isDesktop = useIsDesktop()
  const canceled = order.posStatus === 'canceled'
  const paid = order.paidAmount >= order.totalAmount && order.totalAmount > 0
  const lines = itemLines(order.items)
  const qty = lines.reduce((s, l) => s + l.qty, 0)
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
  const typeColor = isDelivery ? '#f59e0b' : isDineIn ? '#8b5cf6' : '#64748b'
  const statusLabel = canceled ? 'Anulado' : 'Entregado'
  const frozenMs = frozenElapsedMs(order)

  return (
    <div
      style={{
        border: `1.5px solid var(--line)`,
        borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
        boxShadow: isSelected ? '0 6px 20px rgba(0,0,0,.13), 0 2px 6px rgba(0,0,0,.07)' : 'var(--sh-1)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
        fontFamily: 'var(--sans)',
        transition: 'box-shadow .15s, transform .15s',
        opacity: canceled ? 0.8 : 1,
      }}
      onClick={onSelect}
    >
      {/* Body */}
      <div style={{ padding: '16px 18px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(order.orderReference || order.dailyNumber != null) && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 7 }}>#{order.orderReference ?? order.dailyNumber}</span>}
              {displayName(order.customerName || 'Cliente')}
              {qty > 0 && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--ink-3)', marginLeft: 7 }}>{qty} ítem{qty !== 1 ? 's' : ''}</span>}
            </div>
            <div style={{ fontSize: 14.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{new Date(order.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {(isDelivery && order.addressLine) ? (
                <>
                  {isDesktop && <span style={{ color: 'var(--ink-4)' }}>·</span>}
                  <span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, color: 'var(--ink-3)', position: 'relative', top: -1 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>{cleanAddr(order.addressLine)}
                  </span>
                </>
              ) : isDineIn ? (
                <span>Salón</span>
              ) : (
                <span>Retiro en local</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, color: canceled ? 'var(--ink-3)' : 'var(--ink)', textDecoration: canceled ? 'line-through' : 'none' }}>
              {clp(order.totalAmount)}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {showBranch && order._branchName && <span style={chip('#6366f1')}>{order._branchName}</span>}
              {(() => { const s = sourceTag(order); return <span style={chip(s.color)}>{s.label}</span> })()}
              <span style={chip(typeColor)}>{typeLabel}</span>
              <span style={chip(paid ? '#16a34a' : '#f59e0b')}>{paid ? 'Pagado' : 'Sin cobro'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer neutral */}
      <div style={{
        padding: '11px 18px',
        background: 'var(--sunk)',
        borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-3)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>{statusLabel}</span>
        </span>
        {frozenMs != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink-3)' }} title="Tiempo total del pedido">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            {fmtElapsed(frozenMs)}
          </span>
        )}
      </div>
    </div>
  )
}

interface BranchInfo { id: string; name: string; branchName?: string | null }

// ── Main component ────────────────────────────────────────────────────
export default function PosHistorialPanel({ restaurantId, title, allBranches }: { restaurantId: string; title?: string; onDone?: () => void; allBranches?: BranchInfo[] }) {
  const isDesktop = useIsDesktop()
  const today = todayYmd()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [orders, setOrders] = useState<HistorialOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<HistorialOrder | null>(null)

  // Branches to fetch: all branches when multi-mode, otherwise just the single restaurantId
  const branches: BranchInfo[] = allBranches && allBranches.length > 1
    ? allBranches
    : [{ id: restaurantId, name: '', branchName: null }]
  const isMultiBranch = branches.length > 1

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    setSelected(null)
    Promise.all(
      branches.map(b =>
        fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${b.id}&scope=historial&from=${from}&to=${to}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : { orders: [] })
          .then(d => (Array.isArray(d.orders) ? d.orders : []).map((o: HistorialOrder) => ({ ...o, _branchName: b.branchName || b.name })))
          .catch(() => [] as HistorialOrder[])
      )
    )
      .then(results => {
        const combined = results.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setOrders(combined)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, from, to, allBranches])

  const listSection = (
    <div className="pos-scroll">
      <div className="pos-pad">
        {title && <p className="pos-inner-title">{title}</p>}

        <DateRangePicker
          fromDate={from} toDate={to} today={today}
          onFromChange={v => { setFrom(v); if (v > to) setTo(v) }}
          onToChange={v => { setTo(v); if (v < from) setFrom(v) }}
          onRange={(f, t) => { setFrom(f); setTo(t) }}
        />

        {loading ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <p>Sin pedidos en este rango.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {orders.map(o => (
              <HistorialCard
                key={o.id}
                order={o}
                isSelected={selected?.id === o.id}
                onSelect={() => setSelected(prev => prev?.id === o.id && isDesktop ? null : o)}
                showBranch={isMultiBranch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const detailSection = selected ? (
    <PastOrderDetail order={selected as unknown as PastOrder} onClose={() => setSelected(null)} restaurantId={restaurantId} />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', height: '100%', padding: 24, textAlign: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 500 }}>Selecciona un pedido</span>
    </div>
  )

  // Desktop: split layout
  if (isDesktop) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
        {listSection}
        <div className={`pos-split-right${selected ? '' : ' empty'}`}>
          {detailSection}
        </div>
      </div>
    )
  }

  // Mobile: list + bottom sheet
  return (
    <>
      {listSection}
      {selected && (
        <div className="pos-modal-overlay" onClick={() => setSelected(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '18px 18px 0 0', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -4px 32px rgba(0,0,0,.18)' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)', margin: '10px auto 0', flexShrink: 0 }} />
            <PastOrderDetail order={selected as unknown as PastOrder} onClose={() => setSelected(null)} restaurantId={restaurantId} mobileClose />
          </div>
        </div>
      )}
    </>
  )
}
