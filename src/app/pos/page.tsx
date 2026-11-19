'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  usePosSync,
  useTables,
  useSectors,
  usePosConfigLoaded,
  usePendingSyncCount,
  setRestaurantId,
  setUserId,
  backfillPosConfig,
  purgeMirrorAccounts,
} from '@/lib/pos'
import type { PosTable } from '@/lib/pos'
import { usePosCash } from '@/lib/pos/cashApi'
import PosHeader from './components/PosHeader'
import PosMenuDrawer from './components/PosMenuDrawer'
import { usePosNav } from './lib/usePosNav'
import { usePosRestaurant, switchPosBranch } from './lib/usePosRestaurant'
import type { PosRestaurant } from './lib/usePosRestaurant'
import { useIsDesktop } from './lib/useIsDesktop'
import OrdersBoard, { OrderDetailPanel, CobroModal } from './components/OrdersBoard'
import PrepAlertWatcher from './components/PrepAlertWatcher'
import DelifastCancelWatcher from './components/DelifastCancelWatcher'
import { LiveClock } from './components/OrderClock'
import PosCartaPanel from './components/panels/PosCartaPanel'
import PosCajaPanel from './components/panels/PosCajaPanel'
import PosConfigPanel from './components/panels/PosConfigPanel'
import PosHistorialPanel from './components/panels/PosHistorialPanel'
import PosReportesPanel from './components/panels/PosReportesPanel'
import PosFloorView from './components/PosFloorView'
import NuevoPedidoModal, { prefetchMenu } from './components/NuevoPedidoModal'

const TEST_USER_ID = 'pos-garzon'

type Tab = 'mesas' | 'retiro' | 'delivery' | 'todos' // retiro kept for backward compat

const INNER_PAGES: Record<string, { title: string; component: React.ComponentType<any> }> = {
  carta: { title: 'Carta', component: PosCartaPanel },
  historial: { title: 'Historial de pedidos', component: PosHistorialPanel },
  caja: { title: 'Caja', component: PosCajaPanel },
  config: { title: 'Configuración', component: PosConfigPanel },
  reportes: { title: 'Reportes', component: PosReportesPanel },
}
const TABS: { id: Tab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'delivery', label: 'Pedidos' },
  { id: 'mesas', label: 'Mesas' },
]

// ── Modals ────────────────────────────────────────────────────────

function PendingModal({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-title">{count} evento{count !== 1 ? 's' : ''} pendiente{count !== 1 ? 's' : ''}</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
          Hay acciones registradas localmente que aún no se han sincronizado con el servidor.
          Se sincronizarán automáticamente cuando haya conexión a internet.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          Los datos están guardados de forma segura en este dispositivo. No se perderá ningún pedido, pago ni anulación.
        </p>
        <div className="pos-modal-actions">
          <button className="pos-modal-ok" style={{ flex: 1 }} onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export default function PosHomePage() {
  const rawNavigate = usePosNav()
  const isDesktop = useIsDesktop()
  const { restaurantId, restaurant, restaurants, loading: posLoading, posEnabled, isOwner } = usePosRestaurant()

  // Auth guard: redirect to login if session resolved but no restaurant found
  useEffect(() => {
    if (!posLoading && !restaurantId) {
      window.location.href = '/pos/login'
    }
  }, [posLoading, restaurantId])

  // ── Multi-branch mode ────────────────────────────────────────────
  // branchMode: restaurantId (single branch) | 'todas' | '' (defaults to current)
  const [branchMode, setBranchMode] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('pos:branchMode') || ''
  })
  // La sucursal guardada solo vale si pertenece a ESTA sesión. Si se cambió de
  // dueño (admin → "entrar como owner" de otro local) el localStorage queda
  // apuntando a una marca de OTRO dueño; usarla hacía que config/caja leyeran y
  // escribieran al local equivocado → "No autorizado" (assertOwnership falla por
  // dueño distinto). Si no pertenece, se cae a la sucursal primaria.
  const branchIsValid = branchMode === 'todas' || (!!branchMode && restaurants.some(r => r.id === branchMode))
  const effectiveBranchMode = branchIsValid ? branchMode : restaurantId
  // Limpia el localStorage si quedó una sucursal de otra sesión/dueño.
  useEffect(() => {
    if (!restaurants.length) return // esperar a que carguen las sucursales
    if (branchMode && branchMode !== 'todas' && !restaurants.some(r => r.id === branchMode)) {
      localStorage.setItem('pos:branchMode', '')
      setBranchMode('')
    }
  }, [restaurants, branchMode])
  // allBranches: only populated when "todas" is active and there are 2+ branches
  const allBranches = useMemo(
    () => effectiveBranchMode === 'todas' && restaurants.length > 1 ? restaurants : undefined,
    [effectiveBranchMode, restaurants]
  )

  function handleBranchSelect(id: string) {
    if (id === 'todas') {
      localStorage.setItem('pos:branchMode', 'todas')
      setBranchMode('todas')
    } else if (id !== restaurantId) {
      // Different branch → preserve inner page and tab across reload
      if (innerPage) localStorage.setItem('pos:restoreInnerPage', innerPage)
      if (tab !== 'todos') localStorage.setItem('pos:restoreTab', tab)
      localStorage.setItem('pos:branchMode', id)
      switchPosBranch(id)
    } else {
      // Same as current → just exit "todas" mode
      localStorage.setItem('pos:branchMode', id)
      setBranchMode(id)
    }
  }

  const { syncing, ready: syncReady } = usePosSync(restaurantId)
  const { caja: cashSession, step: cajaStep, loading: cashLoading } = usePosCash(restaurantId)
  const tables = useTables(restaurantId)
  const sectors = useSectors(restaurantId)
  const configLoaded = usePosConfigLoaded(restaurantId)
  const pendingCount = usePendingSyncCount()

  // ── Mesas server-authoritative: la ocupación sale de los PosOrder dine-in
  // ABIERTOS (impagos), no del sistema Dexie. Al cobrar, la mesa se libera.
  const [posFloorConfig, setPosFloorConfig] = useState<any>(null)
  // ── Nuevo pedido modal (soporta múltiples minimizados) ──
  const [npOrders, setNpOrders] = useState<{ id: number; open: boolean; mesa: { label: string; orderId?: string } | null }[]>([])
  const npCounter = useRef(0)
  // Pre-cargar menú en background al montar
  useEffect(() => { if (restaurantId) prefetchMenu(restaurantId) }, [restaurantId])
  const openNewOrder = useCallback((mesa?: { label: string; orderId?: string }) => {
    const id = ++npCounter.current
    setNpOrders(prev => [...prev, { id, open: true, mesa: mesa || null }])
  }, [])
  // Interceptar navegación a tomar-pedido y mesa para abrir modal
  const navigate = useCallback((path: string) => {
    if (path === '/pos/tomar-pedido') { openNewOrder(); return }
    const mesaMatch = path.match(/^\/pos\/mesa\/([^?]+)(\?order=(.+))?/)
    if (mesaMatch) { openNewOrder({ label: decodeURIComponent(mesaMatch[1]), orderId: mesaMatch[3] || undefined }); return }
    rawNavigate(path)
  }, [rawNavigate, openNewOrder])
  const closeOrder = useCallback((id: number) => {
    setNpOrders(prev => prev.filter(o => o.id !== id))
  }, [])
  const minimizeOrder = useCallback((id: number) => {
    setNpOrders(prev => prev.map(o => o.id === id ? { ...o, open: false } : o))
  }, [])
  const restoreOrder = useCallback((id: number) => {
    setNpOrders(prev => prev.map(o => o.id === id ? { ...o, open: true } : o))
  }, [])

  const [mesaOrders, setMesaOrders] = useState<any[]>([])
  const [mesaCuenta, setMesaCuenta] = useState<{ order: any; key: string } | null>(null)
  // Multi-branch mesa orders (for "todas las sucursales" mode)
  const [allBranchMesas, setAllBranchMesas] = useState<{ branchId: string; branchName: string; orders: any[] }[]>([])
  const fetchMesaOrders = useCallback(async () => {
    if (!restaurantId) return
    try {
      const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      const list = Array.isArray(d.orders) ? d.orders : []
      setMesaOrders(list.filter((o: any) =>
        (o.saleType === 'dine-in' || o.saleType === 'dinein') &&
        o.posStatus !== 'canceled' &&
        (o.paidAmount || 0) < (o.totalAmount || 0),
      ))
    } catch { /* noop */ }
  }, [restaurantId])
  // Fetch mesas from all branches
  const fetchAllBranchMesas = useCallback(async () => {
    if (!restaurants || restaurants.length < 2) return
    const results: { branchId: string; branchName: string; orders: any[] }[] = []
    for (const branch of restaurants) {
      try {
        const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${branch.id}&scope=activos`, { cache: 'no-store' })
        if (!r.ok) continue
        const d = await r.json()
        const list = Array.isArray(d.orders) ? d.orders : []
        const dineIn = list.filter((o: any) =>
          (o.saleType === 'dine-in' || o.saleType === 'dinein') &&
          o.posStatus !== 'canceled' &&
          (o.paidAmount || 0) < (o.totalAmount || 0),
        )
        results.push({ branchId: branch.id, branchName: (branch as any).branchName || branch.name, orders: dineIn })
      } catch { /* noop */ }
    }
    setAllBranchMesas(results)
  }, [restaurants])
  const mesaOrderByLabel = useMemo(() => {
    const m = new Map<string, any>()
    for (const o of mesaOrders) {
      const k = String(o.tableLabel || '').trim()
      if (k && !m.has(k)) m.set(k, o)
    }
    return m
  }, [mesaOrders])
  // Cobro + avance de etapa para el panel de mesa (reusa OrderDetailPanel/CobroModal
  // del board → mismo detalle en Mesas y en Todos).
  const [mesaCobro, setMesaCobro] = useState<any>(null)
  const [mesaStageBusy, setMesaStageBusy] = useState<string | null>(null)
  const changeMesaStage = useCallback(async (o: any, stage: string) => {
    setMesaStageBusy(o?.id ?? null)
    try {
      await fetch('/api/panel/ecommerce/pos-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, id: o.id, opsStage: stage }) })
    } catch { /* noop */ }
    setMesaStageBusy(null)
    fetchMesaOrders()
  }, [restaurantId, fetchMesaOrders])

  // La caja es server-authoritative (usePosCash): cashSession===null = cerrada
  // confirmada por el servidor; no hace falta el fallback a cash-status.

  // Timer: re-render cada 60s + al volver al tab (browsers congelan timers en bg)
  const [, setTick] = useState(0)
  useEffect(() => {
    const tick = () => setTick(n => n + 1)
    const t = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'todos'
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'mesas' || t === 'delivery' || t === 'todos') return t
    if (t === 'retiro') return 'todos' // backward compat: retiro merged into pedidos
    // Restore tab from branch switch
    const saved = localStorage.getItem('pos:restoreTab')
    if (saved) { localStorage.removeItem('pos:restoreTab'); return (saved === 'mesas' || saved === 'delivery') ? saved : 'todos' }
    return 'todos'
  })
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingModal, setPendingModal] = useState(false)
  const [innerPage, setInnerPage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem('pos:restoreInnerPage')
    if (saved) { localStorage.removeItem('pos:restoreInnerPage'); return saved }
    // Read from URL path: /pos/reportes → 'reportes'
    const path = window.location.pathname
    for (const key of Object.keys(INNER_PAGES)) {
      if (path === `/pos/${key}`) return key
    }
    return null
  })

  const openInnerPage = useCallback((id: string | null) => {
    setInnerPage(id)
    // Al cerrar una inner page se conserva la pestaña activa en la URL, así un refresh
    // vuelve a la misma pestaña (y NO reabre Config por una URL /pos/config stale).
    const base = tab === 'todos' ? '/pos' : `/pos?tab=${tab}`
    window.history.replaceState(null, '', id ? `/pos/${id}` : base)
  }, [tab])

  // Cambiar de pestaña: limpia la inner page Y la URL (si no, al salir de Config la URL
  // quedaba en /pos/config y el refresh reabría Config).
  const selectTab = useCallback((t: Tab) => {
    setTab(t)
    setInnerPage(null)
    window.history.replaceState(null, '', t === 'todos' ? '/pos' : `/pos?tab=${t}`)
  }, [])

  const handleReportesStateChange = useCallback((tab: string, from: string, to: string, chart: string, branch: string) => {
    const params = new URLSearchParams({ tab, from, to, chart, branch })
    window.history.replaceState(null, '', `/pos/reportes?${params.toString()}`)
  }, [])

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
    // Migración one-time: sube la config vieja (Dexie/pos_events) al servidor si
    // éste aún está vacío para el local. Idempotente (ver backfillPosConfig).
    backfillPosConfig(restaurantId)
    purgeMirrorAccounts()
  })

  // Tab counts for badges — mesas ocupadas = PosOrder dine-in abiertos.
  const ocupadas = mesaOrders.length

  const [orderCounts, setOrderCounts] = useState<{ retiro: number; delivery: number }>({ retiro: 0, delivery: 0 })
  // Pedidos activos + umbral de la alerta de preparación — para el watcher global.
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [prepAlertMin, setPrepAlertMin] = useState<number | null>(null)
  const [readyAlertMin, setReadyAlertMin] = useState<number | null>(null)
  const refreshOrdersRef = useRef<() => void>(() => {})

  // Callback que recibe la lista de pedidos activos directamente desde OrdersBoard
  // (que ya tiene polling cada 15s + realtime). Así los counts siempre están en sync
  // con lo que muestra el tablero, sin necesitar una suscripción paralela.
  const handleOrdersUpdate = useCallback((orders: any[]) => {
    const delivery = orders.filter((o: any) => o.isDelivery || o.saleType === 'delivery').length
    const retiro = orders.filter((o: any) => !o.isDelivery && o.saleType !== 'delivery' && o.saleType !== 'dine-in' && o.saleType !== 'dinein').length
    setOrderCounts({ retiro, delivery })
    setActiveOrders(orders)
  }, [])

  // prepAlertMin / readyAlertMin: se cargan una vez al montar (no cambian frecuentemente)
  useEffect(() => {
    if (!restaurantId) return
    const fetchAlertConfig = async () => {
      try {
        const r = await fetch(`/api/panel/ecommerce/pos-orders?restaurantId=${restaurantId}&scope=activos`, { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        if (typeof d.prepAlertMinutes === 'number') setPrepAlertMin(d.prepAlertMinutes)
        if (typeof d.readyAlertMinutes === 'number') setReadyAlertMin(d.readyAlertMinutes)
      } catch { /* noop */ }
    }
    fetchAlertConfig()
  }, [restaurantId])

  // Load floor plan config (refresca al entrar a Mesas para reflejar lo recién guardado)
  useEffect(() => {
    if (!restaurantId) return
    fetch(`/api/admin/locales/${restaurantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setPosFloorConfig(d?.posFloorConfig ?? null))
      .catch(() => {})
  }, [restaurantId, tab])

  // Ocupación de mesas: refresca SIEMPRE cada 15s (badge visible en todas las tabs).
  useEffect(() => {
    if (!restaurantId) return
    fetchMesaOrders()
    if (effectiveBranchMode === 'todas') fetchAllBranchMesas()
    const iv = setInterval(() => {
      fetchMesaOrders()
      if (effectiveBranchMode === 'todas') fetchAllBranchMesas()
    }, 15_000)
    const onVis = () => { if (document.visibilityState === 'visible') { fetchMesaOrders(); if (effectiveBranchMode === 'todas') fetchAllBranchMesas() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [restaurantId, fetchMesaOrders, fetchAllBranchMesas, effectiveBranchMode])

  // refreshOrdersRef se pasa a OrdersBoard que lo apunta a su fetchOrders interno.
  // PrepAlertWatcher y DelifastCancelWatcher lo usan para forzar un re-fetch.

  const totalAll = orderCounts.retiro + orderCounts.delivery + ocupadas
  const totalOnline = orderCounts.retiro + orderCounts.delivery
  const tabCounts: Partial<Record<Tab, number>> = {
    ...(totalAll > 0 ? { todos: totalAll } : {}),
    ...(totalOnline > 0 ? { delivery: totalOnline } : {}),
    ...(ocupadas > 0 ? { mesas: ocupadas } : {}),
  }

  // Handlers
  const handleMesaClick = (table: PosTable) => {
    const key = table.label || String(table.number)
    const order = mesaOrderByLabel.get(key)
    if (!order) {
      // Mesa libre: tomar el primer pedido (modo mesa) → ocupa al enviar. Ruta
      // propia /pos/mesa/<label> (no /pos/tomar-pedido) para no mezclar el caché.
      navigate(`/pos/mesa/${encodeURIComponent(key)}`)
    } else {
      // Mesa ocupada: abre la cuenta (ítems + Agregar ítems + Cobrar).
      setMesaCuenta({ order, key })
    }
  }

  // Render de una tarjeta de mesa. Ocupación = PosOrder dine-in abierto (impago)
  // anclado a esta mesa por tableLabel. Muestra el total acumulado y el tiempo.
  const renderMesaButton = (table: PosTable) => {
    const key = table.label || String(table.number)
    const order = mesaOrderByLabel.get(key)
    const occupied = !!order
    const status = occupied ? 'con_pedidos' : 'libre'
    const isSelected = isDesktop && mesaCuenta?.key === key
    const mesaMeta = (order?.rawPayload && typeof order.rawPayload === 'object' && !Array.isArray(order.rawPayload) ? (order.rawPayload as Record<string, any>).mesa : null) as { covers?: number; garzon?: string } | null
    const covers = mesaMeta?.covers
    const garzon = mesaMeta?.garzon
    return (
      <div key={table.id} className={`pos-mesa-cell ${status}`}>
        <button
          className={`pos-mesa ${status}${isSelected ? ' panel-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleMesaClick(table) }}
        >
          {/* Número/label de la mesa — siempre visible, grande, dentro del cuadrado */}
          <span className="pos-mesa-num">{key}</span>
          <div className="pos-mesa-center">
            {occupied ? (
              <>
                {covers ? <span className="pos-mesa-covers"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>{covers}</span> : null}
                <span className="ms" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>${Math.round(order.totalAmount || 0).toLocaleString('es-CL')}</span>
              </>
            ) : null}
          </div>
          {occupied ? (
            <div className="pos-mesa-bottom">
              <span className="pos-mesa-time" style={{ width: '100%', display: 'inline-flex', justifyContent: 'center' }}><LiveClock since={order.createdAt} icon={false} style={{ fontWeight: 'inherit', color: 'inherit' }} /></span>
            </div>
          ) : (
            <div className="pos-mesa-bottom">
              <span className="pos-mesa-time" style={{ width: '100%', textAlign: 'center', opacity: 0.5 }}>Libre</span>
            </div>
          )}
        </button>
        {occupied && garzon ? (
          <span className="pos-mesa-garzon" title={garzon}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>
            {garzon}
          </span>
        ) : null}
      </div>
    )
  }

  // Mientras resuelve la sesión, no mostrar nada (el useEffect redirige si no hay sesión)
  if (posLoading || (!posLoading && !restaurantId)) return null

  // Guard de acceso: si el local tiene el POS deshabilitado (posEnabled === false
  // vía sesión de panel) no se muestra. null = desconocido (sin sesión) → se permite.
  if (posEnabled === false) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--sunk)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <span style={{ fontSize: 30 }}>🧾</span>
          </div>
          <h1 style={{ fontFamily: "var(--sans)", fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
            Punto de venta no disponible
          </h1>
          <p style={{ fontFamily: "var(--sans)", fontSize: "0.9rem", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
            Este módulo está en beta y aún no está habilitado para tu local. Contáctanos si quieres activarlo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pos-shell">
      {/* Alerta global de reparto cancelado en Delifast. */}
      {restaurantId && (
        <DelifastCancelWatcher restaurantId={restaurantId} orders={activeOrders} onChanged={() => refreshOrdersRef.current()} />
      )}
      {/* ── Header — siempre visible con tabs ── */}
      <PosHeader
        mode="brand"
        storeName={restaurant?.name}
        branchName={restaurant?.branchName ?? null}
        syncing={syncing}
        onMenu={() => setMenuOpen(m => !m)}
        onPendingClick={() => setPendingModal(true)}
        onBrandClick={() => selectTab('todos')}
        centerSlot={
          <div className="pos-tabs-bar">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`pos-tab${tab === t.id && !innerPage ? ' on' : ''}`}
                onClick={() => selectTab(t.id)}
              >
                {t.label}
                {tabCounts[t.id] ? <span className="pos-tab-badge">{tabCounts[t.id]}</span> : null}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Caja cerrada — ribbon siempre visible ── */}
      {/* Se muestra solo cuando la caja está CERRADA confirmada: cashSession===null
          (no undefined=cargando) Y la primera sincronización del local terminó
          (syncReady). Así no parpadea en cada sync incremental ni al cambiar de
          sucursal (mientras sincroniza el nuevo local, syncReady=false → no se
          muestra el falso "caja cerrada"). */}
      {!isOwner && restaurants.length <= 1 && cashSession === null && syncReady && !cashLoading && (() => {
        // Guía del paso pendiente (flujo obligatorio): 1 abrir turno · 2 abrir
        // caja · 4 cerrar turno. (En 3 la caja está abierta → no se muestra.)
        const msg = cajaStep === 1 ? 'Abre el turno para empezar'
          : cajaStep === 4 ? 'Falta cerrar el turno'
          : 'Falta abrir la caja'
        const cta = cajaStep === 1 ? 'Abrir turno →' : cajaStep === 4 ? 'Cerrar turno →' : 'Abrir caja →'
        return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, flexWrap: 'wrap',
          background: 'var(--amber-tint)',
          borderBottom: '1px solid var(--amber-tint)',
          padding: '9px 18px', flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--amber-press)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/>
          </svg>
          <span style={{ color: 'var(--amber-press)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--sans)' }}>{msg}</span>
          <button
            onClick={() => openInnerPage('caja')}
            style={{ border: 'none', background: 'var(--amber)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sans)' }}
          >
            {cta}
          </button>
        </div>
      )})()}

      {/* ── Branch pills — below caja ribbon ── */}
      {restaurants.length > 1 && (
        <div className="pos-branch-bar">
          {restaurants.map(r => (
            <button
              key={r.id}
              className={`pos-branch-pill${effectiveBranchMode === r.id ? ' on' : ''}`}
              onClick={() => handleBranchSelect(r.id)}
            >
              {r.branchName || r.name}
            </button>
          ))}
          <button
            className={`pos-branch-pill${effectiveBranchMode === 'todas' ? ' on' : ''}`}
            onClick={() => handleBranchSelect('todas')}
          >
            Todas
          </button>
        </div>
      )}

      {/* ── Inner page (carta, caja, impresora, etc.) ── */}
      {innerPage && INNER_PAGES[innerPage] && (
        <>
          {React.createElement(INNER_PAGES[innerPage].component, {
              // Si hay una sucursal específica seleccionada con los pills, pasarla como restaurantId.
              // Para "todas" se mantiene el primario + allBranches para fetch en paralelo.
              restaurantId: effectiveBranchMode !== 'todas' ? effectiveBranchMode : restaurantId,
              title: INNER_PAGES[innerPage].title,
              onDone: () => openInnerPage(null),
              allBranches,
              ...(innerPage === 'reportes' ? {
                initialTab: new URLSearchParams(window.location.search).get('tab') || undefined,
                initialFrom: new URLSearchParams(window.location.search).get('from') || undefined,
                initialTo: new URLSearchParams(window.location.search).get('to') || undefined,
                initialChart: new URLSearchParams(window.location.search).get('chart') || undefined,
                onStateChange: handleReportesStateChange,
              } : {}),
            })}
        </>
      )}

      {/* ── Main content (solo cuando no hay inner page) ── */}
      {!innerPage && <>

      {/* ── Retiro / Delivery / Todos ── */}
      {(tab === 'delivery' || tab === 'todos') && (
        <OrdersBoard restaurantId={restaurantId} type={tab} allBranches={allBranches} onOrdersUpdate={handleOrdersUpdate} refreshRef={refreshOrdersRef} onNewOrder={() => openNewOrder()} />
      )}

      {/* ── Mesas en modo Todas: vista multi-sucursal ── */}
      {tab === 'mesas' && effectiveBranchMode === 'todas' && (
        <div className="pos-scroll" style={{ flex: 1, minHeight: 0 }}>
          <div className="pos-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPIs */}
            {(() => {
              const totalOcupadas = allBranchMesas.reduce((s, b) => s + b.orders.length, 0)
              const totalVenta = allBranchMesas.reduce((s, b) => s + b.orders.reduce((ss: number, o: any) => ss + (o.totalAmount || 0), 0), 0)
              const avgTicket = totalOcupadas > 0 ? Math.round(totalVenta / totalOcupadas) : 0
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: '1.4rem', fontWeight: 900, color: '#8b5cf6' }}>{totalOcupadas}</div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: '0.68rem', color: 'var(--ink-3)', fontWeight: 600 }}>Mesas ocupadas</div>
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', fontWeight: 900, color: 'var(--ink)' }}>${totalVenta.toLocaleString('es-CL')}</div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: '0.68rem', color: 'var(--ink-3)', fontWeight: 600 }}>Venta en mesa</div>
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', fontWeight: 900, color: 'var(--ink)' }}>${avgTicket.toLocaleString('es-CL')}</div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: '0.68rem', color: 'var(--ink-3)', fontWeight: 600 }}>Ticket promedio</div>
                  </div>
                </div>
              )
            })()}

            {/* Por sucursal */}
            {allBranchMesas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: '0.84rem' }}>
                Cargando mesas...
              </div>
            ) : allBranchMesas.every(b => b.orders.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: '0.84rem' }}>
                No hay mesas ocupadas en ninguna sucursal.
              </div>
            ) : (
              allBranchMesas.map(branch => (
                <div key={branch.branchId} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                  {/* Branch header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: branch.orders.length > 0 ? '1px solid var(--line)' : 'none', background: branch.orders.length > 0 ? '#8b5cf608' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--sans)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)' }}>{branch.branchName}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: branch.orders.length > 0 ? '#8b5cf620' : 'var(--sunk)', color: branch.orders.length > 0 ? '#8b5cf6' : 'var(--ink-3)' }}>
                        {branch.orders.length} {branch.orders.length === 1 ? 'mesa' : 'mesas'}
                      </span>
                    </div>
                    {branch.orders.length > 0 && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--ink)' }}>
                        ${branch.orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0).toLocaleString('es-CL')}
                      </span>
                    )}
                  </div>
                  {/* Mesa rows */}
                  {branch.orders.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {branch.orders.map((o: any, i: number) => {
                        const mins = Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000)
                        const timeStr = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`
                        const paid = (o.paidAmount || 0) >= (o.totalAmount || 0) && (o.totalAmount || 0) > 0
                        const status = paid ? 'Pagado' : o.posStatus === 'preparing' ? 'Preparando' : o.posStatus === 'ready' ? 'Listo' : mins > 60 ? 'Esperando cuenta' : 'Comiendo'
                        const statusColor = paid ? '#22c55e' : o.posStatus === 'preparing' ? '#f59e0b' : o.posStatus === 'ready' ? '#3b82f6' : mins > 60 ? '#ef4444' : '#8b5cf6'
                        return (
                          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                            {/* Mesa icon */}
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${statusColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10"/><path d="M19 8v10"/><path d="M3 18h18"/></svg>
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'var(--sans)', fontSize: '0.84rem', fontWeight: 800, color: 'var(--ink)' }}>{o.tableLabel || 'Mesa'}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: `${statusColor}18`, color: statusColor }}>{status}</span>
                              </div>
                              <div style={{ fontFamily: 'var(--sans)', fontSize: '0.72rem', color: 'var(--ink-3)', marginTop: 1 }}>
                                {o.customerName || 'Sin nombre'} · {timeStr}
                              </div>
                            </div>
                            {/* Amount */}
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink)', flexShrink: 0 }}>
                              ${(o.totalAmount || 0).toLocaleString('es-CL')}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Split layout: izquierda (mesas) + derecha (panel) ── */}
      {tab === 'mesas' && effectiveBranchMode !== 'todas' && (
      <div className="pos-split-wrapper" style={isDesktop ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' } : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Lista de mesas (columna izquierda en desktop) ──────────── */}
      <div className={isDesktop ? 'pos-split-left pos-scroll' : 'pos-scroll'} onClick={isDesktop ? () => setMesaCuenta(null) : undefined}>
        <div className="pos-pad">

            {/* MESAS — Floor plan view (solo si el local activó "usar distribución real") */}
          {tab === 'mesas' && posFloorConfig?.enabled && tables.some(t => t.x > 0 || t.y > 0) && (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <PosFloorView
              tables={tables}
              config={posFloorConfig}
              mesaOrderByLabel={mesaOrderByLabel}
              sectors={sectors}
              onMesaClick={handleMesaClick}
              selectedKey={mesaCuenta?.key}
            />
            </div>
          )}

            {/* MESAS — Grid view (filas corridas; si el toggle de distribución está apagado) */}
          {tab === 'mesas' && !(posFloorConfig?.enabled && tables.some(t => t.x > 0 || t.y > 0)) && (() => {
            const filteredTables = sectorFilter === 'all'
              ? tables
              : sectorFilter === 'none'
                ? tables.filter(t => !t.sector_id)
                : tables.filter(t => t.sector_id === sectorFilter)

            return tables.length > 0 ? (
              <>
                {/* Sector pills — solo cuando hay 2+ sectores */}
                {sectors.length > 1 && (
                  <div className="pos-sector-pills">
                    <button
                      className={`pos-sector-pill${sectorFilter === 'all' ? ' on' : ''}`}
                      onClick={() => setSectorFilter('all')}
                    >
                      Todos <span className="pos-sector-count">{tables.length}</span>
                    </button>
                    {sectors.map(s => {
                      const count = tables.filter(t => t.sector_id === s.id).length
                      return (
                        <button
                          key={s.id}
                          className={`pos-sector-pill${sectorFilter === s.id ? ' on' : ''}`}
                          onClick={() => setSectorFilter(s.id)}
                        >
                          {s.name}
                          {count > 0 && <span className="pos-sector-count">{count}</span>}
                        </button>
                      )
                    })}
                    {tables.some(t => !t.sector_id) && (
                      <button
                        className={`pos-sector-pill${sectorFilter === 'none' ? ' on' : ''}`}
                        onClick={() => setSectorFilter('none')}
                      >
                        Sin sector <span className="pos-sector-count">{tables.filter(t => !t.sector_id).length}</span>
                      </button>
                    )}
                  </div>
                )}
                {sectorFilter === 'all' && sectors.length > 1 ? (
                  <>
                    {sectors.map(s => {
                      const group = tables.filter(t => t.sector_id === s.id)
                      if (group.length === 0) return null
                      return (
                        <div key={s.id} className="pos-sector-group">
                          <div className="pos-sector-head">{s.name}<span className="pos-sector-count">{group.length}</span></div>
                          <div className="pos-mesa-grid">{group.map(renderMesaButton)}</div>
                        </div>
                      )
                    })}
                    {(() => {
                      const sinSector = tables.filter(t => !t.sector_id || !sectors.some(s => s.id === t.sector_id))
                      if (sinSector.length === 0) return null
                      return (
                        <div className="pos-sector-group">
                          <div className="pos-sector-head">Sin sector<span className="pos-sector-count">{sinSector.length}</span></div>
                          <div className="pos-mesa-grid">{sinSector.map(renderMesaButton)}</div>
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <div className="pos-mesa-grid">
                    {filteredTables.map(renderMesaButton)}
                    {filteredTables.length === 0 && (
                      <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '20px 0' }}>
                        Sin mesas en este sector
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : !configLoaded ? (
              // Mientras llega la config del servidor: NO mostrar "Sin mesas"
              // (parpadeaba al recargar). Mismo layout para no saltar.
              <div className="pos-empty" style={{ minHeight: 200 }} aria-busy="true">
                <div className="ring">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                </div>
                <p style={{ opacity: 0.55 }}>Cargando mesas…</p>
              </div>
            ) : (
              <div className="pos-empty" style={{ minHeight: 200 }}>
                <div className="ring">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                </div>
                <p>
                  Sin mesas configuradas.{' '}
                  <button
                    onClick={() => navigate('/pos/config/mesas')}
                    style={{ color: 'var(--amber-press)', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
                  >
                    Configurar mesas
                  </button>
                </p>
              </div>
            )
          })()}

        </div>
      </div>

      {/* ── Panel detalle (columna derecha en desktop) — mismo OrderDetailPanel
           que la pestaña Todos. Mesa seleccionada = PosOrder dine-in abierto. ── */}
      {isDesktop && (
        <div className={`pos-split-right${mesaCuenta ? '' : ' empty'}`}>
          {mesaCuenta ? (
            <OrderDetailPanel
              order={mesaCuenta.order}
              restaurantId={restaurantId}
              cajaOpen={!!cashSession}
              stageBusy={mesaStageBusy}
              delifastEnabled={false}
              blocked={false}
              onStageChange={changeMesaStage}
              onCobro={(o) => setMesaCobro(o)}
              onBlock={() => {}}
              onDismissBlock={() => {}}
              onClose={() => setMesaCuenta(null)}
              onPaid={() => { setMesaCuenta(null); fetchMesaOrders() }}
              navigate={navigate}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)', height: '100%', padding: 24, textAlign: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Selecciona una mesa</span>
            </div>
          )}
        </div>
      )}

      </div>
      )}{/* /pos-split-wrapper */}

      {/* ── Modals ──────────────────────────────────────────── */}
      {pendingModal && <PendingModal count={pendingCount} onClose={() => setPendingModal(false)} />}
      {/* Cuenta de mesa en MOBILE (sin panel lateral): pantalla completa.
          En desktop se muestra docked en pos-split-right (arriba). Mismo
          OrderDetailPanel que Todos. */}
      {!isDesktop && mesaCuenta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
          <OrderDetailPanel
            order={mesaCuenta.order}
            restaurantId={restaurantId}
            cajaOpen={!!cashSession}
            stageBusy={mesaStageBusy}
            delifastEnabled={false}
            blocked={false}
            onStageChange={changeMesaStage}
            onCobro={(o) => setMesaCobro(o)}
            onBlock={() => {}}
            onDismissBlock={() => {}}
            onClose={() => setMesaCuenta(null)}
            onPaid={() => { setMesaCuenta(null); fetchMesaOrders() }}
            navigate={navigate}
          />
        </div>
      )}
      {/* Cobro de mesa (reusa CobroModal del board) → al cobrar, cierra el pedido
          (delivered) para liberar la mesa y mandarla al historial, + boleta. */}
      {mesaCobro && (
        <CobroModal
          order={mesaCobro}
          restaurantId={restaurantId}
          type="todos"
          delifastEnabled={false}
          onClose={() => setMesaCobro(null)}
          onPaid={async () => {
            try { await fetch('/api/panel/ecommerce/pos-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, id: mesaCobro.id, opsStage: 'delivered' }) }) } catch { /* la mesa igual se libera al refrescar (pagada) */ }
            setMesaCobro(null); setMesaCuenta(null); fetchMesaOrders()
          }}
        />
      )}

      </>}{/* /!innerPage */}

      {/* ── Drawer ── */}
      {menuOpen && <PosMenuDrawer cashSession={!!cashSession} restaurant={restaurant} onClose={() => setMenuOpen(false)} onNavigate={navigate} onInline={openInnerPage} />}

      {/* ── Modales nuevo pedido (multi-pedido) ── */}
      {(() => {
        const minimizedIds = npOrders.filter(o => !o.open).map(o => o.id)
        return npOrders.map(np => (
          <NuevoPedidoModal
            key={np.id}
            restaurantId={restaurantId}
            open={np.open}
            onClose={() => closeOrder(np.id)}
            onMinimize={() => minimizeOrder(np.id)}
            onRestore={() => restoreOrder(np.id)}
            onOrderCreated={() => { closeOrder(np.id); refreshOrdersRef.current?.(); fetchMesaOrders() }}
            tableLabel={np.mesa?.label}
            existingOrderId={np.mesa?.orderId}
            minimizedIndex={minimizedIds.indexOf(np.id)}
          />
        ))
      })()}
    </div>
  )
}

