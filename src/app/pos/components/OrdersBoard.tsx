'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setRestaurantId, setUserId, useOpenCashSession } from '@/lib/pos'
import type { PaymentMethod } from '@/lib/pos'
import { getBridgeStatus, printComanda, printKitchenComanda } from '@/lib/pos/bridge'
import { usePosNav } from '../lib/usePosNav'
import { useIsDesktop } from '../lib/useIsDesktop'
import { LiveClock, FrozenClock } from './OrderClock'
import DelifastTracking from './DelifastTracking'

type OrderType = 'retiro' | 'delivery' | 'todos'

// Paleta de cobro: ámbar = pendiente (estado normal), rojo = advertencia al
// intentar avanzar sin cobrar. El rojo es transitorio y descartable.
const AMBER = '#f59e0b'
const RED = '#dc2626'

const TEST_USER_ID = 'pos-garzon'

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'webpay', label: 'Webpay' },
]

interface PosOrderLite {
  id: string
  dailyNumber?: number | null
  orderReference?: string | null
  customerName: string
  customerPhone: string
  addressLine: string
  tableLabel?: string | null
  saleType: string
  isDelivery: boolean
  opsStage: string
  opsReadyForDeliveryAt?: string | null
  totalAmount: number
  paidAmount: number
  tipAmount: number
  changeAmount: number
  deliveryFee: number
  vendorName?: string | null
  items: unknown
  createdAt: string
  rawPayload?: unknown
}

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')

function cleanAddr(addr: string): string {
  return addr
    .replace(/,?\s*chile\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/g, '')
    .trim()
}

const STAGE_LABEL: Record<string, string> = {
  preparing: 'En preparación',
  ready: 'Listo',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
}

const STAGE_COLOR: Record<string, string> = {
  preparing: '#f59e0b',
  ready: '#16a34a',
  out_for_delivery: '#3b82f6',
  delivered: '#6b7280',
}

function nextAction(stage: string, isDelivery: boolean): { label: string; stage: string } | null {
  if (stage === 'preparing') return { label: 'Listo', stage: 'ready' }
  if (stage === 'ready' && isDelivery) return { label: 'Enviar a reparto', stage: 'out_for_delivery' }
  if (stage === 'ready' && !isDelivery) return { label: 'Entregado', stage: 'delivered' }
  if (stage === 'out_for_delivery') return { label: 'Entregado', stage: 'delivered' }
  return null
}

function prevAction(stage: string): { label: string; stage: string } | null {
  if (stage === 'ready') return { label: 'Volver a preparación', stage: 'preparing' }
  if (stage === 'out_for_delivery') return { label: 'Volver a listo', stage: 'ready' }
  return null
}

const isPaid = (o: PosOrderLite) => o.totalAmount > 0 && o.paidAmount >= o.totalAmount

// Extrae los nombres de las opciones/modificadores elegidos de un ítem, soportando
// las dos formas en que se guardan (array de strings del espejo, o de objetos
// {value}/{optionName}/{name} del OnlineOrder).
function itemOptions(o: Record<string, unknown>): string[] {
  const raw = (o.options ?? o.selectedOptions ?? o.modifiers) as unknown
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => (typeof x === 'string' ? x : String((x as Record<string, unknown>)?.value ?? (x as Record<string, unknown>)?.optionName ?? (x as Record<string, unknown>)?.name ?? '')))
    .map((s) => s.trim())
    .filter(Boolean)
}

function itemLines(items: unknown): { name: string; qty: number; price: number; options: string[]; note: string }[] {
  if (!Array.isArray(items)) return []
  return items.map((it) => {
    const o = (it || {}) as Record<string, unknown>
    const name = String(o.name ?? o.productName ?? o.title ?? o.description ?? 'Ítem')
    const qty = Number(o.quantity ?? o.qty ?? o.cantidad ?? 1) || 1
    const price = Number(o.price ?? o.unitPrice ?? o.unit_price ?? o.precio ?? 0) || 0
    const note = String(o.note ?? o.comment ?? '').trim()
    return { name, qty, price, options: itemOptions(o), note }
  })
}

// Guarda compartida: antes de marcar "Entregado" un pedido de delivery, verifica
// con Delifast que realmente se entregó. SOLO corre en locales con Delifast
// integrado (delifastEnabled); los demás marcan entregado sin fricción. Si
// Delifast aún no lo reporta entregado, pide confirmación. Fail-open ante errores.
async function confirmDeliveredIfNeeded(restaurantId: string, order: PosOrderLite, delifastEnabled: boolean): Promise<boolean> {
  if (!delifastEnabled) return true
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  if (!isDelivery) return true
  try {
    const res = await fetch(`/api/pos/delivery-tracking?restaurantId=${restaurantId}&posOrderId=${order.id}`, { cache: 'no-store' })
    const d = await res.json()
    const tr = d?.tracking
    if (d?.configured && tr && !tr.timeline?.entregado) {
      return window.confirm('El repartidor aún no ha entregado este pedido según Delifast. ¿Marcar entregado de todas formas?')
    }
  } catch { /* sin verificación → se permite */ }
  return true
}

// Cronómetro del pedido: en retiro, una vez "listo" el tiempo se CONGELA (hora
// de listo − creación); en el resto cuenta en vivo hasta que se finaliza.
function OrderTimer({ order, isRetiro, icon = true, style }: { order: PosOrderLite; isRetiro: boolean; icon?: boolean; style?: React.CSSProperties }) {
  if (isRetiro && order.opsStage === 'ready' && order.opsReadyForDeliveryAt) {
    return <FrozenClock from={order.createdAt} to={order.opsReadyForDeliveryAt} icon={icon} style={style} />
  }
  return <LiveClock since={order.createdAt} icon={icon} style={style} />
}

// ── Order card ──────────────────────────────────────────────────────

function OrderCard({
  order, isSelected, showTypeChip, stageBusy, blocked,
  onSelect, onStageChange, onCobro, onBlock, onDismissBlock,
}: {
  order: PosOrderLite
  isSelected: boolean
  showTypeChip: boolean
  stageBusy: string | null
  blocked: boolean
  onSelect: () => void
  onStageChange: (o: PosOrderLite, stage: string) => void
  onCobro: (o: PosOrderLite) => void
  onBlock: (o: PosOrderLite) => void
  onDismissBlock: () => void
}) {
  const isDesktop = useIsDesktop()
  const paid = isPaid(order)
  const lines = itemLines(order.items)
  const qty = lines.reduce((s, l) => s + l.qty, 0)
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const isRetiro = !isDelivery && !isDineIn
  const typeLabel = isDelivery ? 'Delivery' : isDineIn ? 'Salón' : 'Retiro'
  const typeColor = isDelivery ? '#64748b' : isDineIn ? '#8b5cf6' : '#64748b'
  const next = nextAction(order.opsStage, isDelivery)
  const busy = stageBusy === order.id

  // Realce de la tarjeta: rojo si está bloqueada (intento de avanzar sin cobrar),
  // ámbar si está impaga, normal si está pagada.
  const shell: React.CSSProperties = blocked
    ? { border: `1.5px solid ${RED}`, boxShadow: `0 0 0 1px ${RED}, 0 8px 22px rgba(220,38,38,.22)` }
    : !paid
      ? { border: `1.5px solid ${AMBER}cc`, boxShadow: `0 0 0 1px ${AMBER}73, 0 8px 22px rgba(245,158,11,.20)` }
      : { border: '1.5px solid var(--line)', boxShadow: isSelected ? '0 6px 20px rgba(0,0,0,.13), 0 2px 6px rgba(0,0,0,.07)' : 'var(--sh-1)' }

  // Texto secundario (dirección / mesa / retiro) uniforme para todas las tarjetas.
  const secondary = (isDelivery && order.addressLine)
    ? cleanAddr(order.addressLine)
    : isDineIn && order.tableLabel
      ? order.tableLabel
      : (!isDelivery && !isDineIn)
        ? 'Retiro en local'
        : ''

  return (
    <div
      style={{
        borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
        ...shell,
        transform: isSelected ? 'translateY(-2px)' : 'none',
        fontFamily: 'var(--sans)',
        transition: 'box-shadow .2s ease, border-color .2s ease, transform .15s ease',
        display: 'flex', flexDirection: 'column', height: '100%',
      }}
      onClick={onSelect}
    >
      {/* Body: nombre + info secundaria. flex:1 para empujar el footer abajo y
          que todas las tarjetas de una fila queden a la misma altura. */}
      <div style={{
        padding: '14px 16px',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', gap: 8,
        flex: 1, minWidth: 0,
      }}>
        {/* Fila 1: [nombre · chip tipo] ↔ [monto · chip pago] */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <div style={{
              fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>
              {(order.orderReference || order.dailyNumber != null) && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 7 }}>#{order.orderReference ?? order.dailyNumber}</span>}
              {order.customerName || 'Cliente'}
            </div>
            {showTypeChip && <span style={{ ...chip(typeColor), flexShrink: 0 }}>{typeLabel}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>
              {clp(order.totalAmount)}
            </span>
            <span style={chip(paid ? '#16a34a' : AMBER)}>{paid ? 'PAGADO' : 'POR PAGAR'}</span>
          </div>
        </div>

        {/* Fila 2: dirección / mesa / retiro */}
        {secondary && <div style={{
          fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.4,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3,
          overflow: 'hidden', wordBreak: 'break-word',
        }}>
          {isDelivery && order.addressLine && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: 'var(--ink-3)', position: 'relative', top: -1 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
          )}
          {secondary}
        </div>}

        {/* Fila 3: hora · N ítems */}
        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>{new Date(order.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
          {qty > 0 && <><span style={{ color: 'var(--ink-4)' }}>·</span><span>{qty} ítem{qty !== 1 ? 's' : ''}</span></>}
        </div>
      </div>

      {/* Footer coloreado: estado + (si está pagado) botón de avance */}
      <div
        style={{
          padding: '11px 16px',
          background: (STAGE_COLOR[order.opsStage] ?? '#aaa') + '14',
          borderTop: `1px solid ${(STAGE_COLOR[order.opsStage] ?? '#aaa')}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          flexWrap: 'wrap', rowGap: 8,
        }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: STAGE_COLOR[order.opsStage] ?? 'var(--ink-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[order.opsStage] ?? '#aaa', flexShrink: 0 }} />
            {STAGE_LABEL[order.opsStage] ?? order.opsStage}
          </span>
          <OrderTimer order={order} isRetiro={isRetiro} style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }} />
        </span>
        {/* Pagado: avanzar es la acción principal. Impago: el avance vive en la
            franja de cobro de abajo (interceptado). */}
        {paid && next && (
          <button
            onClick={() => onStageChange(order, next.stage)}
            disabled={busy}
            style={{
              fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none',
              background: STAGE_COLOR[next.stage] ?? 'var(--amber)', color: '#fff',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              fontFamily: 'var(--sans)', flexShrink: 0, marginLeft: 'auto',
            }}
          >
            {busy ? '…' : next.label + ' →'}
          </button>
        )}
      </div>

      {/* Franja de cobro — solo si está impago. Cobrar es la acción principal. */}
      {!paid && (
        <CobroStrip
          order={order} next={next} blocked={blocked} busy={busy}
          onCobro={onCobro} onBlock={onBlock} onStageChange={onStageChange} onDismissBlock={onDismissBlock}
        />
      )}
    </div>
  )
}

// Franja de cobro reutilizable (tarjeta y panel). Ámbar = pago pendiente; al
// intentar avanzar se pone roja con la advertencia, sin modal y descartable.
function CobroStrip({
  order, next, blocked, busy, onCobro, onBlock, onStageChange, onDismissBlock,
}: {
  order: PosOrderLite
  next: { label: string; stage: string } | null
  blocked: boolean
  busy: boolean
  onCobro: (o: PosOrderLite) => void
  onBlock: (o: PosOrderLite) => void
  onStageChange: (o: PosOrderLite, stage: string) => void
  onDismissBlock: () => void
}) {
  const balance = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0))
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        padding: '12px 18px 14px',
        background: blocked ? 'rgba(220,38,38,.08)' : 'rgba(245,158,11,.10)',
        borderTop: `1px solid ${blocked ? RED : AMBER}2e`,
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'background .2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={blocked ? RED : AMBER} strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}>
          {blocked
            ? <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>
            : <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>}
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: blocked ? RED : 'var(--amber-press)', lineHeight: 1.35 }}>
            {blocked ? 'Debes cobrar el pedido antes de cambiar su estado' : 'Pago pendiente'}
          </div>
          {!blocked && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>Cobra el pedido para poder avanzar su estado.</div>}
        </div>
        {blocked && (
          <button onClick={onDismissBlock} title="Descartar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, padding: 2, lineHeight: 0, flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => onCobro(order)}
          style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '11px 14px', borderRadius: 10, border: 'none',
            background: 'var(--amber)', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: 'pointer', fontFamily: 'var(--sans)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          Cobrar {clp(balance || order.totalAmount)}
        </button>
        {next && (
          blocked ? (
            <button
              onClick={() => onStageChange(order, next.stage)}
              disabled={busy}
              style={{
                flexShrink: 0, padding: '11px 12px', borderRadius: 10,
                border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-3)',
                fontWeight: 600, fontSize: 12.5, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'var(--sans)',
              }}
              title="Avanzar el estado sin cobrar (quedará en Por cobrar)"
            >
              {busy ? '…' : 'Avanzar sin cobrar'}
            </button>
          ) : (
            <button
              onClick={() => onBlock(order)}
              style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '11px 14px', borderRadius: 10,
                border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {next.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Order detail panel ──────────────────────────────────────────────

function OrderDetailPanel({
  order, restaurantId, cajaOpen, stageBusy, delifastEnabled, blocked, onStageChange, onCobro, onBlock, onDismissBlock, onClose, onPaid, navigate,
}: {
  order: PosOrderLite
  restaurantId: string
  cajaOpen: boolean
  stageBusy: string | null
  delifastEnabled: boolean
  blocked: boolean
  onStageChange: (o: PosOrderLite, stage: string) => void
  onCobro: (o: PosOrderLite) => void
  onBlock: (o: PosOrderLite) => void
  onDismissBlock: () => void
  onClose: () => void
  onPaid: () => void
  navigate: (path: string) => void
}) {
  const paid = isPaid(order)
  const isDelivery = order.isDelivery || order.saleType === 'delivery'
  const isDineIn = !isDelivery && (order.saleType === 'dine-in' || order.saleType === 'dinein')
  const isRetiro = !isDelivery && !isDineIn
  const next = nextAction(order.opsStage, isDelivery)
  const lines = itemLines(order.items)
  const busy = stageBusy === order.id
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [printing, setPrinting] = useState<'ticket' | 'kitchen' | null>(null)
  const [printMsg, setPrintMsg] = useState<string | null>(null)

  const bridgeType = (): 'mesa' | 'mostrador' | 'retiro' | 'delivery' =>
    isDelivery ? 'delivery' : isDineIn ? 'mesa' : 'retiro'

  const orderLabel = order.orderReference ?? (order.dailyNumber != null ? String(order.dailyNumber) : order.id.slice(-6))

  const handlePrint = async (kind: 'ticket' | 'kitchen') => {
    setPrintOpen(false); setPrinting(kind); setPrintMsg(null)
    const status = await getBridgeStatus()
    if (!status.ok) { setPrintMsg('Agente desconectado'); setPrinting(null); return }
    const r = await printKitchenComanda({
      jobId: order.id + '-' + kind,
      type: bridgeType(),
      orderLabel,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.addressLine,
      sentBy: kind === 'ticket' ? 'caja' : 'cocina',
      items: itemLines(order.items).map(l => ({ quantity: l.qty, dish_name: l.name, modifiers: l.options.map(o => ({ name: o, price_adjustment: 0 })), note: l.note })),
    })
    setPrintMsg(r.ok ? '✓ Impreso' : '✗ ' + (r.error || 'Error'))
    setPrinting(null)
    setTimeout(() => setPrintMsg(null), 3000)
  }

  const handleCancel = async () => {
    setCanceling(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'cancel', reason: cancelReason.trim() }),
      })
      if (r.ok) onPaid()
    } catch { }
    setCanceling(false)
  }

  const handleFinalize = async () => {
    if (!(await confirmDeliveredIfNeeded(restaurantId, order, delifastEnabled))) return
    setFinalizing(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
      if (r.ok) onPaid()
    } catch { }
    setFinalizing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1.2 }}>
            {order.orderReference && <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', marginRight: 8 }}>#{order.orderReference}</span>}
            {order.customerName || 'Cliente'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {isDelivery ? 'Delivery' : isDineIn ? (order.tableLabel || 'Salón') : 'Retiro'} ·
              <OrderTimer order={order} isRetiro={isRetiro} style={{ fontWeight: 800, color: 'var(--ink-2)' }} />
            </span>
            {paid && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#16a34a18', border: '1px solid #16a34a40', color: '#16a34a', fontWeight: 700, fontSize: 12, borderRadius: 20, padding: '2px 9px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Pagado
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative' }}>
          {/* Botón impresora */}
          <button
            onClick={() => setPrintOpen(o => !o)}
            disabled={!!printing}
            title="Imprimir"
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: printOpen ? 'var(--amber-tint)' : 'var(--sunk)', color: printOpen ? 'var(--amber)' : 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, opacity: printing ? 0.5 : 1, transition: 'background .15s, color .15s' }}
          >
            {printing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
            )}
          </button>

          {/* Dropdown */}
          {printOpen && (
            <>
              <div onClick={() => setPrintOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                <button onClick={() => handlePrint('ticket')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 500, textAlign: 'left' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Ticket de caja
                </button>
                <div style={{ height: 1, background: 'var(--line)' }} />
                <button onClick={() => handlePrint('kitchen')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 500, textAlign: 'left' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                  Comanda cocina
                </button>
              </div>
            </>
          )}

          {printMsg && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, fontSize: 12, fontWeight: 600, color: printMsg.startsWith('✓') ? 'var(--jade)' : '#e05252', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 11px', whiteSpace: 'nowrap', zIndex: 10 }}>
              {printMsg}
            </div>
          )}

          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--sunk)', color: 'var(--ink-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Seguimiento del reparto (Delifast) — solo delivery */}
        {isDelivery && <DelifastTracking restaurantId={restaurantId} posOrderId={order.id} />}

        {/* Customer info */}
        {(order.customerPhone || (isDelivery && order.addressLine)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.customerPhone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {order.customerPhone}
              </div>
            )}
            {isDelivery && order.addressLine && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {cleanAddr(order.addressLine)}
              </div>
            )}
          </div>
        )}

        {/* Items */}
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>Ítems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.length > 0 ? lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--amber-press)', marginRight: 6 }}>{l.qty}×</span>
                    {l.name}
                  </span>
                  {l.price > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-2)', flexShrink: 0 }}>{clp(l.price * l.qty)}</span>}
                </div>
                {l.options.length > 0 && (
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)', paddingLeft: 22 }}>{l.options.join(' · ')}</div>
                )}
                {l.note && (
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', paddingLeft: 22 }}>“{l.note}”</div>
                )}
              </div>
            )) : (
              <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Sin detalle de ítems</div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink-2)' }}>
              <span>Despacho</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.deliveryFee)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            <span>Total</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.totalAmount)}</span>
          </div>
          {paid && order.tipAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}>
              <span>Propina</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.tipAmount)}</span>
            </div>
          )}
        </div>

        {/* Stage */}
        {(() => {
          const prev = prevAction(order.opsStage)
          return (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-3)', marginBottom: 10 }}>Etapa</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (next || prev) ? 12 : 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: STAGE_COLOR[order.opsStage] ?? '#aaa', flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: STAGE_COLOR[order.opsStage] ?? 'var(--ink-2)' }}>
                  {STAGE_LABEL[order.opsStage] ?? order.opsStage}
                </span>
              </div>
              {/* Pagado: avanzar es la acción principal. Impago: el avance se
                  gestiona en la franja de cobro de abajo (interceptado). */}
              {paid && next && (
                <button
                  onClick={() => onStageChange(order, next.stage)}
                  disabled={busy}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: STAGE_COLOR[next.stage] ?? 'var(--amber)', color: '#fff',
                    fontWeight: 700, fontSize: 16, cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1, fontFamily: 'var(--sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {busy ? 'Actualizando…' : `${next.label} →`}
                </button>
              )}
              {prev && (
                <button
                  onClick={() => onStageChange(order, prev.stage)}
                  disabled={busy}
                  style={{
                    width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 12,
                    border: '1px solid var(--line)', background: 'transparent',
                    color: 'var(--ink-3)', fontWeight: 600, fontSize: 14,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                    fontFamily: 'var(--sans)',
                  }}
                >
                  ← {prev.label}
                </button>
              )}
            </div>
          )
        })()}

        {/* Cobro — franja ámbar/roja, misma lógica y botones que la tarjeta */}
        {!paid && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${blocked ? RED : AMBER + 'cc'}` }}>
            <CobroStrip
              order={order} next={next} blocked={blocked} busy={busy}
              onCobro={onCobro} onBlock={onBlock} onStageChange={onStageChange} onDismissBlock={onDismissBlock}
            />
          </div>
        )}

        {/* Anular */}
        <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} />
      </div>
    </div>
  )
}

// Ícono del botón de vista: refleja el modo actual (filas / 2 col / 3 col).
function ViewIcon({ cols }: { cols: 1 | 2 | 3 }) {
  if (cols === 1) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="5" width="18" height="4" rx="1" /><rect x="3" y="14" width="18" height="4" rx="1" />
      </svg>
    )
  }
  if (cols === 2) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="7.5" height="16" rx="1" /><rect x="13.5" y="4" width="7.5" height="16" rx="1" />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="4.5" height="16" rx="1" /><rect x="9.75" y="4" width="4.5" height="16" rx="1" /><rect x="16.5" y="4" width="4.5" height="16" rx="1" />
    </svg>
  )
}

// Ícono del botón de orden: barras + flecha que apunta según la dirección.
function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h8M4 12h5M4 17h3" />
      {dir === 'desc'
        ? <path d="M17 7v10M14.5 14.5 17 17l2.5-2.5" />
        : <path d="M17 17V7M14.5 9.5 17 7l2.5 2.5" />}
    </svg>
  )
}

// ── Main component ──────────────────────────────────────────────────

export default function OrdersBoard({ restaurantId, type }: { restaurantId: string; type: OrderType }) {
  const isDesktop = useIsDesktop()
  const [orders, setOrders] = useState<PosOrderLite[]>([])
  const [delifastEnabled, setDelifastEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PosOrderLite | null>(null)
  const [cobro, setCobro] = useState<PosOrderLite | null>(null)
  const [stageBusy, setStageBusy] = useState<string | null>(null)
  const [blockedId, setBlockedId] = useState<string | null>(null)
  // Vista del tablero: 1 = filas, 2/3 = columnas. Se recuerda POR DISPOSITIVO
  // en localStorage. Arranca en 1 para no romper la hidratación y se carga el
  // valor guardado tras montar.
  const [viewCols, setViewCols] = useState<1 | 2 | 3>(1)
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem('pos:boardCols') || '', 10)
      if (v === 1 || v === 2 || v === 3) setViewCols(v)
    } catch { }
  }, [])
  // Máximo de columnas que caben bien según el ancho del dispositivo: teléfono
  // = 1 (en móvil 2/3 columnas se ven apretadas y cortan el texto), tablet = 2,
  // desktop = 3. Arranca en 1 para que el SSR no choque con la hidratación.
  const [maxCols, setMaxCols] = useState<1 | 2 | 3>(1)
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      setMaxCols(w >= 900 ? 3 : w >= 600 ? 2 : 1)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  const cycleView = useCallback(() => {
    setViewCols(prev => {
      const next = (prev >= maxCols ? 1 : prev + 1) as 1 | 2 | 3
      try { localStorage.setItem('pos:boardCols', String(next)) } catch { }
      return next
    })
  }, [maxCols])
  // Columnas efectivas: la preferencia guardada, acotada a lo que cabe.
  const cols = Math.min(viewCols, maxCols) as 1 | 2 | 3
  // Orden de los pedidos: 'desc' = más nuevo primero, 'asc' = más antiguo
  // primero. También se recuerda por dispositivo.
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  useEffect(() => {
    try {
      const v = localStorage.getItem('pos:boardSort')
      if (v === 'asc' || v === 'desc') setSortDir(v)
    } catch { }
  }, [])
  const toggleSort = useCallback(() => {
    setSortDir(prev => {
      const next = prev === 'desc' ? 'asc' : 'desc'
      try { localStorage.setItem('pos:boardSort', next) } catch { }
      return next
    })
  }, [])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = usePosNav()
  const cashSession = useOpenCashSession(restaurantId)
  const cajaOpen = !!cashSession

  // Cobrar: si la caja está cerrada se redirige a abrirla; si no, abre el modal.
  const handleCobro = useCallback((o: PosOrderLite) => {
    setBlockedId(null)
    if (!cajaOpen) { navigate('/pos/caja'); return }
    setCobro(o)
    if (!isDesktop) setSelected(null)
  }, [cajaOpen, isDesktop, navigate])

  // Intento de avanzar un pedido impago → se intercepta y la tarjeta se pone roja.
  const blockAdvance = useCallback((o: PosOrderLite) => setBlockedId(o.id), [])
  const dismissBlock = useCallback(() => setBlockedId(null), [])

  useEffect(() => {
    if (restaurantId) { setRestaurantId(restaurantId); setUserId(TEST_USER_ID) }
  }, [restaurantId])

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
      const d = await r.json()
      if (r.ok && Array.isArray(d.orders)) {
        setOrders(d.orders)
        setDelifastEnabled(!!d.delifastEnabled)
        // Keep selected in sync
        setSelected(prev => prev ? (d.orders.find((o: PosOrderLite) => o.id === prev.id) ?? null) : null)
      }
    } catch { }
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
    timerRef.current = setInterval(fetchOrders, 15_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchOrders])

  const list = useMemo(() => {
    const filtered = orders.filter((o) => {
      if (type === 'todos') return true
      const deliv = o.isDelivery || o.saleType === 'delivery'
      if (type === 'delivery') return deliv
      return !deliv && o.saleType !== 'dine-in' && o.saleType !== 'dinein'
    })
    return filtered.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime()
      const tb = new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? ta - tb : tb - ta
    })
  }, [orders, type, sortDir])

  const changeStage = async (order: PosOrderLite, stage: string) => {
    if (stage === 'delivered' && !(await confirmDeliveredIfNeeded(restaurantId, order, delifastEnabled))) return
    setStageBusy(order.id)
    setBlockedId(null)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: stage }),
      })
      if (r.ok) {
        if (stage === 'delivered') setSelected(null)
        fetchOrders()
      }
    } catch { }
    setStageBusy(null)
  }

  const newOrderLabel = type === 'delivery' ? 'Nuevo delivery' : type === 'retiro' ? 'Nuevo retiro' : 'Nuevo pedido'

  const listSection = (
    <div className="pos-scroll">
      <div className="pos-pad">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            {type === 'delivery' ? 'Delivery' : type === 'retiro' ? 'Retiro' : 'Todos'} · {list.length}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleSort}
              title={`Orden: ${sortDir === 'desc' ? 'más nuevos primero' : 'más antiguos primero'} · toca para invertir`}
              aria-label="Cambiar orden"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 10px', cursor: 'pointer' }}
            >
              <SortIcon dir={sortDir} />
            </button>
            {maxCols > 1 && (
              <button
                onClick={cycleView}
                title={`Vista: ${cols === 1 ? 'filas' : cols + ' columnas'} · toca para cambiar`}
                aria-label="Cambiar vista"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 10px', cursor: 'pointer' }}
              >
                <ViewIcon cols={cols} />
              </button>
            )}
            <button
              onClick={() => navigate('/pos/tomar-pedido')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              {newOrderLabel}
            </button>
          </div>
        </div>

        {/* List */}
        {loading && orders.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--line)', borderTopColor: 'var(--amber)' }} />
          </div>
        ) : list.length === 0 ? (
          <div className="pos-empty" style={{ minHeight: 200 }}>
            <div className="ring">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></svg>
            </div>
            <p>Sin pedidos activos.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 14, alignItems: 'stretch' }}>
            {list.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isSelected={selected?.id === o.id}
                showTypeChip={type === 'todos'}
                stageBusy={stageBusy}
                blocked={blockedId === o.id}
                onSelect={() => {
                  if (isDesktop) {
                    setSelected(prev => prev?.id === o.id ? null : o)
                  } else {
                    setSelected(o)
                  }
                }}
                onStageChange={changeStage}
                onCobro={handleCobro}
                onBlock={blockAdvance}
                onDismissBlock={dismissBlock}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const detailSection = selected ? (
    <OrderDetailPanel
      order={selected}
      restaurantId={restaurantId}
      cajaOpen={cajaOpen}
      stageBusy={stageBusy}
      delifastEnabled={delifastEnabled}
      blocked={blockedId === selected.id}
      onStageChange={changeStage}
      onCobro={handleCobro}
      onBlock={blockAdvance}
      onDismissBlock={dismissBlock}
      onClose={() => setSelected(null)}
      onPaid={() => { setSelected(null); fetchOrders() }}
      navigate={navigate}
    />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', height: '100%', padding: 24, textAlign: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H17"/>
        <circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/>
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
        {cobro && (
          <CobroModal order={cobro} restaurantId={restaurantId} type={type} delifastEnabled={delifastEnabled} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); setBlockedId(null); fetchOrders() }} />
        )}
      </div>
    )
  }

  // Mobile: list + modal for detail
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
            <OrderDetailPanel
              order={selected}
              restaurantId={restaurantId}
              cajaOpen={cajaOpen}
              stageBusy={stageBusy}
              delifastEnabled={delifastEnabled}
              blocked={blockedId === selected.id}
              onStageChange={changeStage}
              onCobro={handleCobro}
              onBlock={blockAdvance}
              onDismissBlock={dismissBlock}
              onClose={() => setSelected(null)}
              onPaid={() => { setSelected(null); fetchOrders() }}
              navigate={navigate}
            />
          </div>
        </div>
      )}
      {cobro && (
        <CobroModal order={cobro} restaurantId={restaurantId} type={type} delifastEnabled={delifastEnabled} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); setBlockedId(null); fetchOrders() }} />
      )}
    </>
  )
}

// ── Modal de cobro ─────────────────────────────────────────────────
function CobroModal({ order, restaurantId, type, delifastEnabled, onClose, onPaid }: { order: PosOrderLite; restaurantId: string; type: OrderType; delifastEnabled: boolean; onClose: () => void; onPaid: () => void }) {
  const total = order.totalAmount || 0
  const paid = isPaid(order)
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [received, setReceived] = useState<string>('')
  const [tip, setTip] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const navigate = usePosNav()

  const handleCancel = async () => {
    setCanceling(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'cancel', reason: cancelReason.trim() }),
      })
      if (r.ok) onPaid()
    } catch { }
    setCanceling(false)
  }

  const [finalizing, setFinalizing] = useState(false)
  const handleFinalize = async () => {
    if (!(await confirmDeliveredIfNeeded(restaurantId, order, delifastEnabled))) return
    setFinalizing(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, opsStage: 'delivered' }),
      })
      if (r.ok) onPaid()
    } catch { }
    setFinalizing(false)
  }

  const receivedNum = parseInt(received, 10) || 0
  const tipNum = parseInt(tip, 10) || 0
  const change = method === 'efectivo' ? Math.max(0, receivedNum - total) : 0
  const canPay = method !== 'efectivo' || receivedNum >= total
  const BILLS = [1000, 2000, 5000, 10000, 20000]

  const handlePay = async () => {
    setSending(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'pay', method, received: receivedNum, tip: tipNum }),
      })
      if (r.ok) onPaid()
    } catch { }
    setSending(false)
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }
  const num: React.CSSProperties = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }

  if (paid) {
    const rp = (order.rawPayload && typeof order.rawPayload === 'object' && !Array.isArray(order.rawPayload)) ? (order.rawPayload as Record<string, unknown>) : {}
    const pp = (rp.posPayment as { method?: string } | undefined) || undefined
    const wp = (rp.webPayment as { method?: string } | undefined) || undefined
    const payLabel = pp?.method || wp?.method || ''
    return (
      <div className="pos-modal-overlay" onClick={onClose}>
        <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
          <div className="pos-modal-title">{order.customerName || 'Cliente'}</div>
          <div style={{ ...row, borderBottom: '1px dashed var(--line-strong)', paddingBottom: 10, marginBottom: 10 }}>
            <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Total</span>
            <span style={{ ...num, fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>{clp(total)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            Pagado{payLabel ? ` · ${payLabel}` : ''}
          </div>
          {order.tipAmount > 0 && <div style={{ ...row }}><span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Propina</span><span style={num}>{clp(order.tipAmount)}</span></div>}
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5 }}>Este pedido ya está pagado. Al cerrarlo se marca como entregado y sale de los activos.</p>
          <div className="pos-modal-actions" style={{ marginTop: 14 }}>
            <button className="pos-modal-cancel" onClick={onClose}>Volver</button>
            <button className="pos-modal-ok" disabled={finalizing} style={{ opacity: finalizing ? 0.6 : 1 }} onClick={handleFinalize}>
              {finalizing ? 'Cerrando…' : 'Cerrar pedido'}
            </button>
          </div>
          <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} />
        </div>
      </div>
    )
  }

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
        <div className="pos-modal-title">Cobrar · {order.customerName || 'Cliente'}</div>

        <div style={{ ...row, borderBottom: '1px dashed var(--line-strong)', paddingBottom: 10, marginBottom: 6 }}>
          <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Total</span>
          <span style={{ ...num, fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>{clp(total)}</span>
        </div>

        <label className="pos-modal-label">Método de pago</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {METHODS.map((m) => (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
              border: method === m.id ? '2px solid var(--amber)' : '1px solid var(--line)',
              background: method === m.id ? 'var(--amber-tint)' : 'var(--sunk)',
              color: method === m.id ? 'var(--amber-press)' : 'var(--ink-2)',
            }}>{m.label}</button>
          ))}
        </div>

        {method === 'efectivo' && (
          <>
            <label className="pos-modal-label">Con cuánto paga</label>
            <input type="number" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} onDoubleClick={() => setReceived(String(total))} placeholder={String(total)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {BILLS.filter((b) => b >= total).slice(0, 4).map((b) => (
                <button key={b} onClick={() => setReceived(String(b))} style={chipSmall}>{clp(b)}</button>
              ))}
            </div>
            <div style={{ ...row, marginBottom: 6 }}>
              <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Vuelto</span>
              <span style={{ ...num, fontWeight: 700, fontSize: 18, color: change > 0 ? 'var(--amber-press)' : 'var(--ink-3)' }}>{clp(change)}</span>
            </div>
          </>
        )}

        <label className="pos-modal-label">Propina (opcional)</label>
        <input type="number" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0"
          style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 16, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

        <div className="pos-modal-actions">
          <button className="pos-modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="pos-modal-ok" disabled={!canPay || sending} onClick={handlePay} style={{ opacity: !canPay || sending ? 0.6 : 1 }}>
            {sending ? 'Cobrando…' : `Cobrar ${clp(total)}`}
          </button>
        </div>

        <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} />
      </div>
    </div>
  )
}

// ── Anular pedido ───────────────────────────────────────────────────
function AnularPedido({ confirm, setConfirm, reason, setReason, canceling, onConfirm }: {
  confirm: boolean; setConfirm: (v: boolean) => void; reason: string; setReason: (v: string) => void; canceling: boolean; onConfirm: () => void;
}) {
  if (!confirm) {
    return (
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }}>
        <button
          onClick={() => setConfirm(true)}
          style={{ background: 'none', border: '1px solid #C53030', borderRadius: 10, padding: '10px 14px', width: '100%', color: '#C53030', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}
        >
          Anular pedido
        </button>
      </div>
    )
  }
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>¿Anular este pedido?</div>
      <input
        value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)"
        style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 14, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Cancelar</button>
        <button onClick={onConfirm} disabled={canceling} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#C53030', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: canceling ? 0.6 : 1, fontFamily: 'var(--sans)' }}>
          {canceling ? 'Anulando…' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function chip(color: string): React.CSSProperties {
  return {
    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
    textTransform: 'uppercase', padding: '3px 6px', borderRadius: 5,
    background: color + '20', color,
  }
}

function stagePill(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 20,
    background: color + '18', border: `1px solid ${color}40`,
    color, fontWeight: 700, fontSize: 13, fontFamily: 'var(--sans)',
  }
}

const chipSmall: React.CSSProperties = {
  padding: '7px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)',
  color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)',
}
