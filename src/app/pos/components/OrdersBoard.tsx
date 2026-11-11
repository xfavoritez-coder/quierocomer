'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setRestaurantId, setUserId } from '@/lib/pos'
import { usePosCash } from '@/lib/pos/cashApi'
import type { PaymentMethod } from '@/lib/pos'
import { getBridgeStatus, printKitchenComanda } from '@/lib/pos/bridge'
import { usePosNav } from '../lib/usePosNav'
import { useIsDesktop } from '../lib/useIsDesktop'
import { LiveClock, FrozenClock } from './OrderClock'
import DelifastTracking, { DelifastStatusPill } from './DelifastTracking'
import { supabase } from '@/lib/supabase'
import CustomerOrdersDrawer from './CustomerOrdersDrawer'

type OrderType = 'retiro' | 'delivery' | 'todos'

// Paleta de cobro: ámbar = pendiente (estado normal), rojo = advertencia al
// intentar avanzar sin cobrar. El rojo es transitorio y descartable.
const AMBER = '#f59e0b'
const RED = '#dc2626'

const TEST_USER_ID = 'pos-garzon'

interface BranchInfo { id: string; name: string; branchName?: string | null }

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
  externalId?: string | null
  customerName: string
  customerEmail?: string | null
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
  delifastVentaId?: string | null
  _branchId?: string  // set internally in multi-branch mode
}

const clp = (n: number) => '$' + (Math.round(n) || 0).toLocaleString('es-CL')
const toName = (s: string) => s.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
// Venta rápida: nombre almacenado puede ser "Rápida #N" (formato viejo) o
// "Venta rápida #N" (nuevo). Siempre mostramos "Venta rápida #N" sin pasar por
// toName (que capitalizaría "rápida" a "Rápida").
const displayName = (s: string) => {
  const m = s.trim().match(/^(Venta\s+)?[Rr][aá]pida\s+#(\d+)$/i)
  if (m) return `Venta rápida #${m[2]}`
  return toName(s)
}

function cleanAddr(addr: string): string {
  return addr
    .replace(/,?\s*chile\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/g, '')
    .trim()
}

function fmtTimeAmPm(d: string) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(d))
    .toLowerCase()
    .replace(/\s*p\.\s*m\.?/i, ' p.m.')
    .replace(/\s*a\.\s*m\.?/i, ' a.m.')
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

function nextAction(stage: string, isDelivery: boolean, delifastVentaId?: string | null): { label: string; stage: string } | null {
  if (stage === 'preparing') return { label: 'Listo', stage: 'ready' }
  // Órdenes con Delifast asignado: Delifast controla los estados de reparto y entrega
  if (stage === 'ready' && isDelivery && delifastVentaId) return null
  if (stage === 'ready' && isDelivery) return { label: 'Enviar a reparto', stage: 'out_for_delivery' }
  if (stage === 'ready' && !isDelivery) return { label: 'Entregado', stage: 'delivered' }
  // Con Delifast activo en reparto: Delifast controla la entrega, no mostrar botón.
  if (stage === 'out_for_delivery' && delifastVentaId) return null
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
    // Intentar extraer precio unitario de los distintos formatos (Toteat, QC, legacy)
    let price = 0
    if (Number(o.unitPriceAfterTax) > 0) price = Number(o.unitPriceAfterTax)
    else if (Number(o.unitPrice) > 0) price = Number(o.unitPrice)
    else if (Number(o.unit_price) > 0) price = Number(o.unit_price)
    else if (Number(o.price) > 0) price = Number(o.price)
    else if (Number(o.precio) > 0) price = Number(o.precio)
    // amountAfterTax y netPrice son totales de línea → dividir por qty
    else if (Number(o.amountAfterTax) > 0) price = Math.round(Number(o.amountAfterTax) / qty)
    else if (Number(o.netPrice) > 0) price = Math.round(Number(o.netPrice) / qty)
    else if (Number(o.unitTotal) > 0) price = Number(o.unitTotal)
    else if (Number(o.amount) > 0) price = Math.round(Number(o.amount) / qty)
    else if (Number(o.total) > 0) price = Math.round(Number(o.total) / qty)
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

function OrderTimer({ order, isRetiro: _isRetiro, icon = true, style }: { order: PosOrderLite; isRetiro: boolean; icon?: boolean; style?: React.CSSProperties }) {
  return <LiveClock since={order.createdAt} icon={icon} style={style} />
}

// ── Order card ──────────────────────────────────────────────────────

function OrderCard({
  order, restaurantId, isSelected, showTypeChip, stageBusy, blocked, branchLabel, cols = 3,
  onSelect, onStageChange, onCobro, onBlock, onDismissBlock,
}: {
  order: PosOrderLite
  restaurantId: string
  isSelected: boolean
  showTypeChip: boolean
  stageBusy: string | null
  blocked: boolean
  branchLabel?: string
  cols?: 1 | 2 | 3
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
  // Pedido de Uber Eats (puede ser delivery o retiro): pill verde adicional, sin
  // reemplazar el de tipo (delivery/retiro).
  const isUberEats = (order.vendorName || '').toLowerCase().includes('uber eats')
  const next = nextAction(order.opsStage, isDelivery, order.delifastVentaId)
  const busy = stageBusy === order.id
  // Cuando Delifast cancela el reparto el footer pasa a rojo aunque opsStage=ready.
  const [delifastCancelled, setDelifastCancelled] = useState(false)
  // Cuando Delifast no tiene tracking real (status vacío = "Reparto"): permitir entrega manual.
  const [delifastNoTracking, setDelifastNoTracking] = useState(false)

  // Realce de la tarjeta: rojo si está bloqueada (intento de avanzar sin cobrar),
  // ámbar si está impaga, normal si está pagada.
  const shell: React.CSSProperties = blocked
    ? { border: `1.5px solid ${RED}`, boxShadow: `0 0 0 1px ${RED}, 0 8px 22px rgba(220,38,38,.22)` }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <div style={{
              fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>
              {(order.orderReference || order.dailyNumber != null) && <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--ink-3)', marginRight: 7 }}>#{order.orderReference ?? order.dailyNumber}</span>}
              {displayName(order.customerName || 'Cliente')}
            </div>
            {cols === 2 && showTypeChip && <span style={{ ...chip(typeColor), flexShrink: 0 }}>{typeLabel}</span>}
            {cols === 2 && showTypeChip && isUberEats && <span style={{ ...chip('#16a34a'), flexShrink: 0 }}>UberEats</span>}
            {cols === 2 && branchLabel && <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 6, background: 'var(--sunk)', border: '1px solid var(--line)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', flexShrink: 0 }}>{branchLabel}</span>}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 15.5, color: 'var(--ink)', flexShrink: 0 }}>
            {clp(order.totalAmount)}
          </span>
        </div>
        {/* Fila 2: chips inline + dirección (el texto fluye y envuelve debajo) */}
        {(secondary || (cols !== 2 && (showTypeChip || branchLabel))) && (
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, wordBreak: 'break-word' }}>
            {cols !== 2 && showTypeChip && <span style={{ ...chip(typeColor), display: 'inline-flex', marginRight: 5, verticalAlign: 'middle', position: 'relative', top: -1 }}>{typeLabel}</span>}
            {cols !== 2 && showTypeChip && isUberEats && <span style={{ ...chip('#16a34a'), display: 'inline-flex', marginRight: 5, verticalAlign: 'middle', position: 'relative', top: -1 }}>UberEats</span>}
            {cols !== 2 && branchLabel && <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 6, background: 'var(--sunk)', border: '1px solid var(--line)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginRight: 5, verticalAlign: 'middle', position: 'relative', top: -1 }}>{branchLabel}</span>}
            {isDelivery && order.addressLine && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, color: 'var(--ink-4)', position: 'relative', top: -1 }}><path d="M12 21C12 21 5 13.5 5 9a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>}
            {secondary}
          </div>
        )}

        {/* Fila 3: hora · N ítems  |  chip pago derecha */}
        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>{new Date(order.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
          {qty > 0 && <><span style={{ color: 'var(--ink-4)' }}>·</span><span>{qty} ítem{qty !== 1 ? 's' : ''}</span></>}
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', flexShrink: 0,
            background: paid ? '#dcfce7' : 'transparent',
            color: paid ? '#15803d' : AMBER,
            border: paid ? 'none' : `1px solid ${AMBER}55`,
          }}>
            {paid ? 'Pagado' : 'Por pagar'}
          </span>
        </div>
      </div>

      {/* Footer coloreado: estado + (si está pagado) botón de avance */}
      {(() => {
        const footerColor = delifastCancelled ? RED : (STAGE_COLOR[order.opsStage] ?? '#aaa')
        const stageLabel = delifastCancelled
          ? 'Reparto cancelado'
          : (STAGE_LABEL[order.opsStage] ?? order.opsStage)
        return (
          <div
            style={{
              padding: '11px 16px',
              minHeight: 56,
              boxSizing: 'border-box',
              background: footerColor + '14',
              borderTop: `1px solid ${footerColor}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              flexWrap: 'wrap', rowGap: 8,
            }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: footerColor }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: footerColor, flexShrink: 0 }} />
                {stageLabel}
              </span>
              <OrderTimer order={order} isRetiro={isRetiro} style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }} />
            </span>
            {/* Botón de avance de etapa — mismo para pagado e impago */}
            {next && (
              <button
                onClick={() => paid ? onStageChange(order, next.stage) : onBlock(order)}
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
            {/* Pill de estado Delifast — visible en ready y out_for_delivery.
                Se muestra también sin delifastVentaId para detectar cancelaciones
                de órdenes rastreadas antes de que se guardara el ventaId. */}
            {paid && order.isDelivery && !delifastCancelled && !delifastNoTracking && order.opsStage !== 'preparing' && order.opsStage !== 'delivered' && (
              <DelifastStatusPill
                restaurantId={order._branchId ?? restaurantId}
                posOrderId={order.id}
                onCancelDetected={() => setDelifastCancelled(true)}
                onNoTracking={() => setDelifastNoTracking(true)}
              />
            )}
            {/* Sin tracking real de Delifast ("Reparto"): botón entrega manual */}
            {paid && delifastNoTracking && !delifastCancelled && order.opsStage === 'out_for_delivery' && (
              <button
                onClick={() => onStageChange(order, 'delivered')}
                disabled={busy}
                style={{
                  fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none',
                  background: STAGE_COLOR.delivered ?? '#6b7280', color: '#fff',
                  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  fontFamily: 'var(--sans)', flexShrink: 0, marginLeft: 'auto',
                }}
              >
                {busy ? '…' : 'Entregado →'}
              </button>
            )}
            {/* Cuando Delifast cancela: botón "Entregado" con confirmación. */}
            {paid && delifastCancelled && order.opsStage === 'out_for_delivery' && (
              <button
                onClick={() => {
                  if (window.confirm('¿Estás seguro que quieres marcar este pedido como entregado?')) {
                    onStageChange(order, 'delivered')
                  }
                }}
                disabled={busy}
                style={{
                  fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none',
                  background: RED, color: '#fff',
                  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  fontFamily: 'var(--sans)', flexShrink: 0, marginLeft: 'auto',
                }}
              >
                {busy ? '…' : 'Entregado →'}
              </button>
            )}
          </div>
        )
      })()}

      {/* Franja de cobro bloqueada — solo si se intentó avanzar sin cobrar */}
      {!paid && blocked && (
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
  const next = nextAction(order.opsStage, isDelivery, order.delifastVentaId)
  const lines = itemLines(order.items)
  const busy = stageBusy === order.id
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [printing, setPrinting] = useState<'ticket' | 'kitchen' | null>(null)
  const [printMsg, setPrintMsg] = useState<string | null>(null)
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [showCustomerHistory, setShowCustomerHistory] = useState(false)
  const [editCustomer, setEditCustomer] = useState(false)
  const [editName, setEditName] = useState(order.customerName || '')
  const [editPhone, setEditPhone] = useState(order.customerPhone || '')
  const [editEmail, setEditEmail] = useState(order.customerEmail || '')
  const [savingCustomer, setSavingCustomer] = useState(false)

  // Cargar solo el conteo de pedidos del cliente (countOnly=1 → solo count(), muy rápido)
  useEffect(() => {
    if (!order.customerPhone) return
    setCustomerCount(null)
    fetch(`/api/panel/ecommerce/pos-orders/customer?restaurantId=${restaurantId}&phone=${encodeURIComponent(order.customerPhone)}&countOnly=1`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (typeof d?.count === 'number') setCustomerCount(d.count) })
      .catch(() => {})
  }, [order.id, order.customerPhone, restaurantId])

  const bridgeType = (): 'mesa' | 'mostrador' | 'retiro' | 'delivery' =>
    isDelivery ? 'delivery' : isDineIn ? 'mesa' : 'retiro'

  const orderLabel = order.orderReference ?? (order.dailyNumber != null ? String(order.dailyNumber) : order.id.slice(-6))

  const handlePrint = async (kind: 'ticket' | 'kitchen') => {
    setPrintOpen(false); setPrinting(kind); setPrintMsg(null)
    const rid = order._branchId || restaurantId
    let r: { ok: boolean; error?: string }
    if (kind === 'ticket') {
      // "Ticket de caja" = reimprime el MISMO ticket que se imprime solo al llegar
      // el pedido (el que trae los valores/total), re-encolándolo para el agente de
      // impresión (print-reenqueue). NO es la comanda simple de mostrador.
      const onlineId = order.externalId?.startsWith('oo-') ? order.externalId.slice(3) : null
      if (!onlineId) { setPrintMsg('✗ Sin ticket de caja para este pedido'); setPrinting(null); setTimeout(() => setPrintMsg(null), 3000); return }
      try {
        const res = await fetch('/api/panel/ecommerce/print-reenqueue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurantId: rid, id: onlineId, ticketOnly: true }),
        })
        const d = await res.json().catch(() => ({}))
        r = res.ok ? { ok: true } : { ok: false, error: d.error || `HTTP ${res.status}` }
      } catch { r = { ok: false, error: 'Error de conexión' } }
      setPrintMsg(r.ok ? '✓ Enviado a impresora' : '✗ ' + (r.error || 'Error'))
      setPrinting(null)
      setTimeout(() => setPrintMsg(null), 3000)
      return
    }
    // "Comanda cocina" = comanda de cocina en letra grande, directo por el agente local.
    const status = await getBridgeStatus()
    if (!status.ok) { setPrintMsg('Agente desconectado'); setPrinting(null); return }
    const items = itemLines(order.items).map(l => ({ quantity: l.qty, dish_name: l.name, modifiers: l.options.map(o => ({ name: o, price_adjustment: 0 })), note: l.note }))
    r = await printKitchenComanda({
      jobId: order.id + '-kitchen',
      type: bridgeType(),
      orderLabel,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.addressLine,
      sentBy: 'cocina',
      items,
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

  const handleSaveCustomer = async () => {
    if (!editName.trim() && !editPhone.trim() && !editEmail.trim()) return
    setSavingCustomer(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, id: order.id, action: 'editCustomer', customerName: editName.trim(), customerPhone: editPhone.trim(), customerEmail: editEmail.trim() }),
      })
      if (r.ok) { setEditCustomer(false); onPaid() }
    } catch { }
    setSavingCustomer(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {showCustomerHistory && order.customerPhone && (
        <CustomerOrdersDrawer
          restaurantId={restaurantId}
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          onClose={() => setShowCustomerHistory(false)}
        />
      )}
      {editCustomer && (
        <div className="pos-modal-overlay" onClick={() => setEditCustomer(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, width: '100%' }}>
            <div className="pos-modal-title">Editar cliente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Nombre</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre del cliente" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Teléfono</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+56 9 1234 5678" type="tel" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pos-modal-cancel" style={{ flex: 1 }} onClick={() => setEditCustomer(false)}>Cancelar</button>
              <button className="pos-modal-ok" style={{ flex: 1, opacity: savingCustomer ? 0.6 : 1 }} disabled={savingCustomer} onClick={handleSaveCustomer}>{savingCustomer ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
        {/* Fila superior: nro pedido */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px 0px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Pedido #{order.orderReference ?? order.id.slice(-6)}
          </span>
          <span style={{ flex: 1 }} />
        </div>

        {/* Fila inferior: nombre cliente + pill historial */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '3px 22px 10px', minWidth: 0, gap: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '0 1 auto', minWidth: 0, marginTop: -2 }}>
              {displayName(order.customerName || 'Cliente')}
            </div>
            <button
              onClick={() => { setEditName(order.customerName || ''); setEditPhone(order.customerPhone || ''); setEditCustomer(true) }}
              title="Editar cliente"
              style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)', lineHeight: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            {order.customerPhone && customerCount !== null && (
              <button
                onClick={() => setShowCustomerHistory(true)}
                title="Ver historial del cliente"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 20,
                  background: customerCount > 1 ? 'var(--amber-tint)' : 'var(--sunk)',
                  color: customerCount > 1 ? 'var(--amber-press)' : 'var(--ink-3)',
                  border: `1px solid ${customerCount > 1 ? 'var(--amber)' : 'var(--line)'}`,
                  cursor: 'pointer', transition: 'opacity .12s',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                {customerCount} pedido{customerCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          {order.customerPhone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.16 6.16l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {order.customerPhone}
            </div>
          )}
          {(() => {
            const email = order.customerEmail ||
              (order.rawPayload && typeof order.rawPayload === 'object'
                ? (order.rawPayload as Record<string, unknown>)?.customerEmail as string | null
                : null)
            return email ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--ink-2)', marginTop: 2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {email}
              </div>
            ) : null
          })()}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Seguimiento del reparto (Delifast) — cinta full-width, pegada al header */}
        {isDelivery && (
          <div style={{ margin: '-16px -22px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--sunk)' }}>
            <DelifastTracking key={order.id} restaurantId={restaurantId} posOrderId={order.id} ribbon />
          </div>
        )}
        {/* Dirección + hora */}
        {(order.createdAt || (isDelivery && order.addressLine)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isDelivery && order.addressLine ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {cleanAddr(order.addressLine)}
              </div>
            ) : !isDelivery && !isDineIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--ink-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Retiro en local
              </div>
            ) : null}
            {order.createdAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink-3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Realizado a las {fmtTimeAmPm(order.createdAt)}
              </div>
            )}
          </div>
        )}

        {/* Notas del pedido */}
        {(() => {
          const orderNotes = (order.rawPayload && typeof order.rawPayload === 'object')
            ? (order.rawPayload as Record<string, unknown>).orderNotes as string | undefined
            : undefined
          return orderNotes ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 13px', borderRadius: 9, background: 'var(--amber-tint)', border: '1px solid var(--amber)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber-press)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: 14, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.45 }}>{orderNotes}</span>
            </div>
          ) : null
        })()}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            <span>Total</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {paid ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', borderRadius: 6, padding: '3px 9px', background: '#f0fdf4', color: '#16a34a' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Pagado
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', borderRadius: 6, padding: '3px 9px', background: 'transparent', color: AMBER, border: `1px solid ${AMBER}55` }}>
                  Por pagar
                </span>
              )}
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.totalAmount)}</span>
            </div>
          </div>
          {paid && order.tipAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}>
              <span>Propina</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{clp(order.tipAmount)}</span>
            </div>
          )}
        </div>


        {/* Cobro — solo si está bloqueado (intentó avanzar sin cobrar) */}
        {!paid && blocked && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${RED}` }}>
            <CobroStrip
              order={order} next={next} blocked={blocked} busy={busy}
              onCobro={onCobro} onBlock={onBlock} onStageChange={onStageChange} onDismissBlock={onDismissBlock}
            />
          </div>
        )}

        {/* Botón Cobrar — visible cuando el pedido no está pagado */}
        {!paid && (
          <button
            onClick={() => onCobro(order)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              padding: '13px 14px', borderRadius: 10, border: 'none',
              background: 'var(--amber)', color: '#fff',
              cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            Cobrar {clp(Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0)) || order.totalAmount)}
          </button>
        )}

        {/* Acciones finales: Imprimir + Anular — mismo contenedor, botones hermanos */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Imprimir ticket */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPrintOpen(o => !o)}
              disabled={!!printing}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${printOpen ? 'var(--ink-3)' : 'var(--line)'}`,
                background: printOpen ? 'var(--sunk)' : 'none',
                color: 'var(--ink)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
                opacity: printing ? 0.6 : 1, transition: 'background .12s, border-color .12s',
              }}
            >
              {printing ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                </svg>
              )}
              Imprimir ticket
            </button>
            {printOpen && (
              <>
                <div onClick={() => setPrintOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
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
              <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, fontSize: 12, fontWeight: 600, color: printMsg.startsWith('✓') ? 'var(--jade)' : '#e05252', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 11px', whiteSpace: 'nowrap', zIndex: 10 }}>
                {printMsg}
              </div>
            )}
          </div>

          {/* Anular pedido */}
          <AnularPedido confirm={confirmCancel} setConfirm={setConfirmCancel} reason={cancelReason} setReason={setCancelReason} canceling={canceling} onConfirm={handleCancel} noBorder />
        </div>
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

// ── Mobile bottom sheet with swipe-down-to-dismiss ──────────────────
function MobileDetailSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [translateY, setTranslateY] = useState(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    dragging.current = true
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = Math.max(0, e.touches[0].clientY - startY.current)
    setTranslateY(delta)
  }
  const onTouchEnd = () => {
    dragging.current = false
    if (translateY > 100) { onClose() } else { setTranslateY(0) }
  }

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderRadius: '18px 18px 0 0',
          maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 -4px 32px rgba(0,0,0,.18)',
          transform: `translateY(${translateY}px)`,
          transition: translateY === 0 ? 'transform .25s ease' : 'none',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)', margin: '10px auto 0', flexShrink: 0 }} />
        {children}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

export default function OrdersBoard({ restaurantId, type, allBranches, onOrdersUpdate, refreshRef }: { restaurantId: string; type: OrderType; allBranches?: BranchInfo[]; onOrdersUpdate?: (orders: PosOrderLite[]) => void; refreshRef?: React.MutableRefObject<() => void> }) {
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
      // v2: nuevo default = 2 columnas en desktop. Clave distinta para ignorar
      // la preferencia anterior (que arrancaba en 1).
      const v = parseInt(localStorage.getItem('pos:boardCols:v2') || '', 10)
      if (v === 1 || v === 2 || v === 3) setViewCols(v)
      else setViewCols(window.innerWidth >= 600 ? 2 : 1)
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
      try { localStorage.setItem('pos:boardCols:v2', String(next)) } catch { }
      return next
    })
  }, [maxCols])
  // Columnas efectivas: la preferencia guardada, acotada a lo que cabe.
  const cols = Math.min(viewCols, maxCols) as 1 | 2 | 3
  // Orden de los pedidos: 'desc' = más nuevo primero, 'asc' = más antiguo
  // Ordenamiento: campo + dirección. Se recuerda en localStorage.
  type SortField = 'hora' | 'total' | 'estado'
  const [sortField, setSortField] = useState<SortField>('hora')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [sortOpen, setSortOpen] = useState(false)
  const [search, setSearch] = useState('')
  useEffect(() => {
    try {
      const f = localStorage.getItem('pos:boardSortField')
      if (f === 'hora' || f === 'total' || f === 'estado') setSortField(f)
      const v = localStorage.getItem('pos:boardSort')
      if (v === 'asc' || v === 'desc') setSortDir(v)
    } catch { }
  }, [])
  const setSort = useCallback((field: SortField, dir: 'asc' | 'desc') => {
    setSortField(field); setSortDir(dir); setSortOpen(false)
    try { localStorage.setItem('pos:boardSortField', field); localStorage.setItem('pos:boardSort', dir) } catch { }
  }, [])
  // orden de stage: más atrasado primero
  const STAGE_ORDER: Record<string, number> = { new: 0, confirmed: 1, preparing: 2, ready: 3, out_for_delivery: 4, delivered: 5 }
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = usePosNav()
  const { caja } = usePosCash(restaurantId)
  const cajaOpen = !!caja

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
    const isMulti = allBranches && allBranches.length > 1
    if (!isMulti && !restaurantId) return
    try {
      if (isMulti) {
        const results = await Promise.all(
          allBranches!.map(b =>
            fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${b.id}&scope=activos`, { cache: 'no-store' })
              .then(r => r.ok ? r.json() : null)
              .then(d => Array.isArray(d?.orders) ? (d.orders as PosOrderLite[]).map(o => ({ ...o, _branchId: b.id })) : [])
              .catch(() => [])
          )
        )
        const merged = results.flat()
        setOrders(merged)
        onOrdersUpdate?.(merged)
        setDelifastEnabled(false)
        setSelected(prev => prev ? (merged.find(o => o.id === prev.id) ?? null) : null)
      } else {
        const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
        const d = await r.json()
        if (r.ok && Array.isArray(d.orders)) {
          setOrders(d.orders)
          onOrdersUpdate?.(d.orders)
          setDelifastEnabled(!!d.delifastEnabled)
          setSelected(prev => prev ? (d.orders.find((o: PosOrderLite) => o.id === prev.id) ?? null) : null)
        }
      }
    } catch { }
    setLoading(false)
  }, [restaurantId, allBranches])

  // Exponer fetchOrders al padre para que PrepAlertWatcher/DelifastCancelWatcher
  // puedan forzar un re-fetch inmediato.
  useEffect(() => {
    if (refreshRef) refreshRef.current = fetchOrders
  }, [refreshRef, fetchOrders])

  useEffect(() => {
    setLoading(true)
    fetchOrders()
    timerRef.current = setInterval(fetchOrders, 15_000)

    // Realtime: re-fetch inmediato cuando cambia cualquier PosOrder del restaurante.
    const ids = allBranches && allBranches.length > 1 ? allBranches.map(b => b.id) : (restaurantId ? [restaurantId] : [])
    const channels = ids.map(id =>
      supabase
        .channel(`orders-board-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'PosOrder', filter: `restaurantId=eq.${id}` }, fetchOrders)
        .subscribe()
    )

    // Volver al tab después de tenerlo en background también recarga.
    const onVis = () => { if (document.visibilityState === 'visible') fetchOrders() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      channels.forEach(ch => supabase.removeChannel(ch))
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchOrders, restaurantId, allBranches])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = orders.filter((o) => {
      if (type !== 'todos') {
        const deliv = o.isDelivery || o.saleType === 'delivery'
        if (type === 'delivery' && !deliv) return false
        if (type === 'retiro' && (deliv || o.saleType === 'dine-in' || o.saleType === 'dinein')) return false
      }
      if (!q) return true
      const ref = (o.orderReference ?? (o.dailyNumber != null ? String(o.dailyNumber) : '')).toLowerCase()
      const name = (o.customerName || '').toLowerCase()
      const phone = (o.customerPhone || '').toLowerCase()
      const address = (o.addressLine || '').toLowerCase()
      return ref.includes(q) || name.includes(q) || phone.includes(q) || address.includes(q)
    })
    return filtered.sort((a, b) => {
      let diff = 0
      if (sortField === 'hora') {
        diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortField === 'total') {
        diff = (a.totalAmount ?? 0) - (b.totalAmount ?? 0)
      } else {
        diff = (STAGE_ORDER[a.opsStage ?? ''] ?? 0) - (STAGE_ORDER[b.opsStage ?? ''] ?? 0)
      }
      return sortDir === 'asc' ? diff : -diff
    })
  }, [orders, type, sortDir, sortField, search])

  const changeStage = async (order: PosOrderLite, stage: string) => {
    const rid = order._branchId || restaurantId
    if (stage === 'delivered' && !(await confirmDeliveredIfNeeded(rid, order, delifastEnabled))) return
    setStageBusy(order.id)
    setBlockedId(null)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: rid, id: order.id, opsStage: stage }),
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
        {/* Header: buscador + botones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {/* Buscador */}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="search"
              placeholder="Buscar pedido…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 32px 8px 32px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 14, outline: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          {/* Botones */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setSortOpen(o => !o)} aria-label="Ordenar" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 10px', cursor: 'pointer' }}>
              <SortIcon dir={sortDir} />
            </button>
            {sortOpen && (
              <>
                <div onClick={() => setSortOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                  {(['hora', 'total', 'estado'] as SortField[]).map(f => {
                    const labels: Record<SortField, string> = { hora: 'Hora del pedido', total: 'Total', estado: 'Estado' }
                    const isActive = sortField === f
                    return (
                      <div key={f} style={{ borderBottom: '1px solid var(--line)' }}>
                        <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{labels[f]}</div>
                        {(['desc', 'asc'] as const).map(d => {
                          const dirLabel: Record<SortField, [string, string]> = {
                            hora: ['Más nuevo primero', 'Más antiguo primero'],
                            total: ['Mayor primero', 'Menor primero'],
                            estado: ['Más atrasado primero', 'Más avanzado primero'],
                          }
                          const active = isActive && sortDir === d
                          return (
                            <button key={d} onClick={() => setSort(f, d)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: active ? 'var(--sunk)' : 'transparent', cursor: 'pointer', fontSize: 13, color: active ? 'var(--ink)' : 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: active ? 700 : 500, textAlign: 'left' }}>
                              {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                              {!active && <span style={{ width: 10 }} />}
                              {dirLabel[f][d === 'desc' ? 0 : 1]}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          {maxCols > 1 && (
            <button onClick={cycleView} title={`Vista: ${cols === 1 ? 'filas' : cols + ' columnas'} · toca para cambiar`} aria-label="Cambiar vista" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 10px', cursor: 'pointer', flexShrink: 0 }}>
              <ViewIcon cols={cols} />
            </button>
          )}
          {!allBranches && (
            <button onClick={() => { if (!cajaOpen) { navigate('/pos/caja'); return } navigate('/pos/tomar-pedido') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              {newOrderLabel}
            </button>
          )}
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
                restaurantId={o._branchId ?? restaurantId}
                isSelected={selected?.id === o.id}
                showTypeChip={type === 'todos'}
                cols={cols}
                stageBusy={stageBusy}
                blocked={blockedId === o.id}
                branchLabel={allBranches && allBranches.length > 1 && o._branchId
                  ? (allBranches.find(b => b.id === o._branchId)?.branchName || allBranches.find(b => b.id === o._branchId)?.name)
                  : undefined}
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
      restaurantId={selected._branchId || restaurantId}
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
          <CobroModal order={cobro} restaurantId={cobro._branchId || restaurantId} type={type} delifastEnabled={delifastEnabled} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); setBlockedId(null); fetchOrders() }} />
        )}

      </div>
    )
  }

  // Mobile: list + bottom sheet with swipe-down-to-dismiss
  return (
    <>
      {listSection}
      {selected && (
        <MobileDetailSheet onClose={() => setSelected(null)}>
          <OrderDetailPanel
            order={selected}
            restaurantId={selected._branchId || restaurantId}
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
        </MobileDetailSheet>
      )}
      {cobro && (
        <CobroModal order={cobro} restaurantId={cobro._branchId || restaurantId} type={type} delifastEnabled={delifastEnabled} onClose={() => setCobro(null)} onPaid={() => { setCobro(null); setBlockedId(null); fetchOrders() }} />
      )}

    </>
  )
}

// ── Modal de cobro ─────────────────────────────────────────────────
function CobroModal({ order, restaurantId, type, delifastEnabled, onClose, onPaid }: { order: PosOrderLite; restaurantId: string; type: OrderType; delifastEnabled: boolean; onClose: () => void; onPaid: () => void }) {
  const total = order.totalAmount || 0
  const paid = isPaid(order)
  // Pagos combinados: lista de partes { método, monto aplicado, recibido }. El
  // caso de un solo método es una lista de 1 (o se arma al cobrar desde el form).
  const [parts, setParts] = useState<{ method: PaymentMethod; amount: number; received: number }[]>([])
  const [curMethod, setCurMethod] = useState<PaymentMethod>('efectivo')
  const [curAmount, setCurAmount] = useState<string>('')   // monto de ESTE método (vacío = lo que resta)
  const [curReceived, setCurReceived] = useState<string>('') // efectivo: con cuánto paga (para el vuelto)
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

  const tipNum = parseInt(tip, 10) || 0
  const mLabel = (m: PaymentMethod) => METHODS.find(x => x.id === m)?.label ?? m
  const BILLS = [1000, 2000, 5000, 10000, 20000]

  const partsTotal = parts.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, total - partsTotal)
  const committedChange = parts.reduce((s, p) => s + (p.method === 'efectivo' ? Math.max(0, p.received - p.amount) : 0), 0)

  // Entrada "en curso" del formulario (lo que todavía no se agrega como parte).
  const curAmountNum = parseInt(curAmount, 10) || 0
  const pendingApplied = remaining > 0 ? (curAmountNum > 0 ? Math.min(curAmountNum, remaining) : remaining) : 0
  const curReceivedNum = parseInt(curReceived, 10) || 0
  const pendingReceived = curMethod === 'efectivo' ? (curReceivedNum > 0 ? curReceivedNum : pendingApplied) : pendingApplied
  const pendingChange = curMethod === 'efectivo' ? Math.max(0, pendingReceived - pendingApplied) : 0
  const totalChange = committedChange + pendingChange
  // Se puede cobrar si las partes ya agregadas + la pendiente cubren el total.
  const canPay = total > 0 && partsTotal + pendingApplied >= total
  // Mostrar "Agregar" (dividir) solo cuando el monto de este método es parcial.
  const canSplit = remaining > 0 && curAmountNum > 0 && curAmountNum < remaining

  const addPart = () => {
    if (pendingApplied <= 0) return
    setParts(prev => [...prev, { method: curMethod, amount: pendingApplied, received: curMethod === 'efectivo' ? pendingReceived : pendingApplied }])
    setCurAmount(''); setCurReceived('')
  }
  const removePart = (i: number) => setParts(prev => prev.filter((_, idx) => idx !== i))

  const handlePay = async () => {
    // Al cobrar, se incluye la entrada pendiente del formulario (si cubre el resto).
    const finalParts = remaining > 0 && pendingApplied > 0
      ? [...parts, { method: curMethod, amount: pendingApplied, received: curMethod === 'efectivo' ? pendingReceived : pendingApplied }]
      : parts
    if (!finalParts.length) return
    setSending(true)
    try {
      const r = await fetch('/api/panel/ecommerce/pos-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId, id: order.id, action: 'pay', tip: tipNum,
          payments: finalParts.map(p => ({ method: p.method, amount: p.amount, received: p.received })),
        }),
      })
      if (r.ok) onPaid()
    } catch { }
    setSending(false)
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }
  const num: React.CSSProperties = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }

  if (paid) {
    const rp = (order.rawPayload && typeof order.rawPayload === 'object' && !Array.isArray(order.rawPayload)) ? (order.rawPayload as Record<string, unknown>) : {}
    const pp = (rp.posPayment as { method?: string; parts?: { method?: PaymentMethod; amount?: number }[] } | undefined) || undefined
    const wp = (rp.webPayment as { method?: string } | undefined) || undefined
    const ppParts = Array.isArray(pp?.parts) ? pp!.parts!.filter(p => (Number(p.amount) || 0) > 0) : []
    const payLabel = ppParts.length > 1
      ? ppParts.map(p => `${METHODS.find(x => x.id === p.method)?.label ?? p.method} ${clp(Number(p.amount) || 0)}`).join(' + ')
      : (pp?.method || wp?.method || '')
    return (
      <div className="pos-modal-overlay" onClick={onClose}>
        <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '100%', position: 'relative' }}>
          <button onClick={onClose} aria-label="Cerrar" style={closeXStyle}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div className="pos-modal-title" style={{ marginBottom: 14, paddingRight: 32 }}>{displayName(order.customerName || 'Cliente')}</div>
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

  const fieldStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 15, fontFamily: 'var(--mono)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '100%', padding: 20, position: 'relative' }}>
        <button onClick={onClose} aria-label="Cerrar" style={closeXStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div className="pos-modal-title" style={{ marginBottom: 10, paddingRight: 32 }}>Cobrar · {displayName(order.customerName || 'Cliente')}</div>

        <div style={{ ...row, borderBottom: '1px dashed var(--line-strong)', paddingBottom: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Total</span>
          <span style={{ ...num, fontWeight: 800, fontSize: 20, color: 'var(--ink)' }}>{clp(total)}</span>
        </div>

        {/* Partes ya agregadas (pago combinado) */}
        {parts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {parts.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--sunk)', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                  {mLabel(p.method)}{p.method === 'efectivo' && p.received > p.amount ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · paga {clp(p.received)}</span> : null}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...num, fontWeight: 700, fontSize: 14 }}>{clp(p.amount)}</span>
                  <button onClick={() => removePart(i)} aria-label="Quitar" style={{ border: 'none', background: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              </div>
            ))}
            <div style={{ ...row, padding: '2px 2px 0' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: remaining > 0 ? 'var(--amber-press)' : '#16a34a' }}>{remaining > 0 ? 'Restante' : 'Cubierto ✓'}</span>
              {remaining > 0 && <span style={{ ...num, fontWeight: 800, fontSize: 15, color: 'var(--amber-press)' }}>{clp(remaining)}</span>}
            </div>
          </div>
        )}

        {/* Formulario para agregar un método (mientras falte por cubrir) */}
        {remaining > 0 && (
          <>
            <label className="pos-modal-label">{parts.length > 0 ? 'Agregar método' : 'Método de pago'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
              {METHODS.map((m) => (
                <button key={m.id} onClick={() => setCurMethod(m.id)} style={{
                  padding: '8px 4px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12,
                  border: curMethod === m.id ? '2px solid var(--amber)' : '1px solid var(--line)',
                  background: curMethod === m.id ? 'var(--amber-tint)' : 'var(--sunk)',
                  color: curMethod === m.id ? 'var(--amber-press)' : 'var(--ink-2)',
                }}>{m.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: curMethod === 'efectivo' ? 8 : 10 }}>
              <div style={{ flex: 1 }}>
                <label className="pos-modal-label" style={{ marginTop: 0 }}>Monto</label>
                <input type="number" inputMode="numeric" value={curAmount} onChange={(e) => setCurAmount(e.target.value)} onDoubleClick={() => setCurAmount(String(remaining))} placeholder={clp(remaining)} title="Doble clic: rellenar con lo que resta" style={fieldStyle} />
              </div>
              {curMethod === 'efectivo' && (
                <div style={{ flex: 1 }}>
                  <label className="pos-modal-label" style={{ marginTop: 0 }}>Con cuánto paga</label>
                  <input type="number" inputMode="numeric" value={curReceived} onChange={(e) => setCurReceived(e.target.value)} onDoubleClick={() => setCurReceived(String(pendingApplied))} placeholder={clp(pendingApplied)} title="Doble clic: paga el monto exacto" style={fieldStyle} />
                </div>
              )}
            </div>

            {curMethod === 'efectivo' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {BILLS.filter((b) => b >= pendingApplied).slice(0, 4).map((b) => (
                  <button key={b} onClick={() => setCurReceived(String(b))} style={chipSmall}>{clp(b)}</button>
                ))}
              </div>
            )}

            {canSplit && (
              <button onClick={addPart} style={{ width: '100%', padding: '9px', borderRadius: 9, border: '1px dashed var(--amber)', background: 'var(--amber-tint)', color: 'var(--amber-press)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)', marginBottom: 6 }}>
                + Agregar este pago y dividir ({clp(curAmountNum)}) · resta {clp(remaining - pendingApplied)}
              </button>
            )}
          </>
        )}

        {totalChange > 0 && (
          <div style={{ ...row, marginBottom: 4 }}>
            <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Vuelto</span>
            <span style={{ ...num, fontWeight: 700, fontSize: 18, color: 'var(--amber-press)' }}>{clp(totalChange)}</span>
          </div>
        )}

        <label className="pos-modal-label">Propina (opcional)</label>
        <input type="number" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" style={{ ...fieldStyle, marginBottom: 14 }} />

        <div className="pos-modal-actions" style={{ marginTop: 0 }}>
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
function AnularPedido({ confirm, setConfirm, reason, setReason, canceling, onConfirm, noBorder }: {
  confirm: boolean; setConfirm: (v: boolean) => void; reason: string; setReason: (v: string) => void; canceling: boolean; onConfirm: () => void; noBorder?: boolean;
}) {
  const wrapStyle = noBorder ? {} : { borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 4 }
  if (!confirm) {
    return (
      <div style={wrapStyle}>
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
    <div style={{ ...wrapStyle, paddingTop: noBorder ? 0 : 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
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

const closeXStyle: React.CSSProperties = {
  position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%',
  border: 'none', background: 'var(--sunk)', color: 'var(--ink-2)', cursor: 'pointer',
  display: 'grid', placeItems: 'center', zIndex: 2,
}
