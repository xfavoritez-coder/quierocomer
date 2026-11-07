'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  usePosSync,
  useOpenAccounts,
  useOpenCashSession,
  useTables,
  useSectors,
  useStaff,
  usePendingSyncCount,
  setRestaurantId,
  setUserId,
  openAccount,
  migrateLocalTablesToEvents,
  migrateLocalStaffToEvents,
  deduplicateStaff,
  purgeMirrorAccounts,
} from '@/lib/pos'
import type { Account, PosStaff, PosTable } from '@/lib/pos'
import PosHeader from './components/PosHeader'
import PosMenuDrawer from './components/PosMenuDrawer'
import { usePosNav } from './lib/usePosNav'
import { usePosRestaurant, switchPosBranch } from './lib/usePosRestaurant'
import type { PosRestaurant } from './lib/usePosRestaurant'
import { useIsDesktop } from './lib/useIsDesktop'
import CuentaPanel from './components/CuentaPanel'
import ComanderoPanel from './components/ComanderoPanel'
import OrdersBoard from './components/OrdersBoard'
import PrepAlertWatcher from './components/PrepAlertWatcher'
import DelifastCancelWatcher from './components/DelifastCancelWatcher'
import { LiveClock } from './components/OrderClock'
import PosCartaPanel from './components/panels/PosCartaPanel'
import PosCajaPanel from './components/panels/PosCajaPanel'
import PosConfigPanel from './components/panels/PosConfigPanel'
import PosHistorialPanel from './components/panels/PosHistorialPanel'
import PosReportesPanel from './components/panels/PosReportesPanel'

const TEST_USER_ID = 'pos-garzon'

type Tab = 'mesas' | 'retiro' | 'delivery' | 'todos'

const INNER_PAGES: Record<string, { title: string; component: React.ComponentType<any> }> = {
  carta: { title: 'Carta', component: PosCartaPanel },
  historial: { title: 'Historial de pedidos', component: PosHistorialPanel },
  caja: { title: 'Caja', component: PosCajaPanel },
  config: { title: 'Configuración', component: PosConfigPanel },
  reportes: { title: 'Reportes', component: PosReportesPanel },
}
type TableStatus = 'libre' | 'abierta' | 'con_pedidos' | 'cuenta_pedida' | 'pagada_parcial'

function getTableStatus(tableId: string, accounts: Account[]): { status: TableStatus; accountId?: string } {
  const acc = accounts.find(a => a.table_id === tableId && !['cerrada', 'anulada'].includes(a.status))
  if (!acc) return { status: 'libre' }
  return { status: acc.status as TableStatus, accountId: acc.id }
}

const statusLabel: Record<TableStatus, string> = {
  libre: 'Libre',
  abierta: 'Abierta',
  con_pedidos: 'Con pedidos',
  cuenta_pedida: 'Cuenta pedida',
  pagada_parcial: 'Pago parcial',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'mesas', label: 'Mesas' },
  { id: 'retiro', label: 'Retiro' },
  { id: 'delivery', label: 'Delivery' },
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

// ── Mesa open modal ───────────────────────────────────────────────

function MesaOpenModal({
  tableLabel,
  garzones,
  onClose,
  onConfirm,
}: {
  tableLabel: string
  garzones: PosStaff[]
  onClose: () => void
  onConfirm: (covers: number, garzonName: string) => void
}) {
  const [covers, setCovers] = useState(2)
  const [garzon, setGarzon] = useState(garzones[0]?.name ?? '')

  const QUICK = [1, 2, 3, 4, 5, 6, 8]

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
        <div className="pos-modal-title">Abrir {tableLabel}</div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <label className="pos-modal-label">Comensales</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
            {QUICK.map(n => (
              <button
                key={n}
                onClick={() => setCovers(n)}
                style={{
                  height: 48, borderRadius: 12,
                  border: covers === n ? '2px solid var(--amber)' : '1px solid var(--line)',
                  background: covers === n ? 'var(--amber-tint)' : 'var(--sunk)',
                  color: covers === n ? 'var(--amber-press)' : 'var(--ink-2)',
                  fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  transition: '.12s',
                }}
              >{n}</button>
            ))}
            <input
              type="number" min={1} max={50}
              value={covers > 8 ? covers : ''}
              placeholder="9+"
              onChange={e => { const v = parseInt(e.target.value); if (v > 0) setCovers(v) }}
              style={{ height: 48, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--sunk)', fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink)', textAlign: 'center', outline: 'none', width: '100%' }}
            />
          </div>

          {garzones.length > 0 && (
            <>
              <label className="pos-modal-label" style={{ marginTop: 12 }}>Garzón</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {garzones.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGarzon(g.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 14px', borderRadius: 12, textAlign: 'left',
                      border: garzon === g.name ? '2px solid var(--amber)' : '1px solid var(--line)',
                      background: garzon === g.name ? 'var(--amber-tint)' : 'var(--sunk)',
                      color: garzon === g.name ? 'var(--amber-press)' : 'var(--ink)',
                      fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)',
                      transition: '.12s',
                    }}
                  >
                    <span style={{ width: 30, height: 30, borderRadius: '50%', background: garzon === g.name ? 'rgba(222,124,0,.15)' : 'var(--surface)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    {g.name}
                    {garzon === g.name && (
                      <span style={{ marginLeft: 'auto' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="pos-modal-actions" style={{ marginTop: 16, flexShrink: 0 }}>
          <button className="pos-modal-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="pos-modal-ok"
            disabled={!covers}
            onClick={() => onConfirm(covers, garzon)}
          >
            Abrir mesa →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Menu drawer ───────────────────────────────────────────────────

// ── Main page ─────────────────────────────────────────────────────

type DesktopPanel =
  | { type: 'cuenta'; accountId: string; tab: Tab }
  | { type: 'comandero'; accountId: string | null; tab: Tab }

export default function PosHomePage() {
  const navigate = usePosNav()
  const isDesktop = useIsDesktop()
  const { restaurantId, restaurant, restaurants, loading: posLoading, posEnabled } = usePosRestaurant()

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
  const effectiveBranchMode = branchMode || restaurantId
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
      // Different branch → preserve inner page across reload
      if (innerPage) localStorage.setItem('pos:restoreInnerPage', innerPage)
      localStorage.setItem('pos:branchMode', id)
      switchPosBranch(id)
    } else {
      // Same as current → just exit "todas" mode
      localStorage.setItem('pos:branchMode', id)
      setBranchMode(id)
    }
  }

  const { syncing, ready: syncReady } = usePosSync(restaurantId)
  const accounts = useOpenAccounts(restaurantId)
  const cashSession = useOpenCashSession(restaurantId)
  const tables = useTables(restaurantId)
  const sectors = useSectors(restaurantId)
  const garzones = useStaff(restaurantId)
  const pendingCount = usePendingSyncCount()

  // Verificación server-side de caja cuando Dexie no tiene sesión tras sync.
  // Evita el falso "caja cerrada" cuando el evento aún no llegó a Supabase desde
  // el terminal del staff (p.ej. el owner abre /pos en un browser nuevo).
  // null = pendiente/desconocido | true = abierta | false = cerrada confirmada
  // IMPORTANTE: en error o timeout NO ponemos false (eso causaba falsos positivos);
  // dejamos null y reintentamos cada 15s hasta obtener respuesta definitiva.
  const [serverCajaOpen, setServerCajaOpen] = useState<boolean | null>(null)
  useEffect(() => {
    if (!restaurantId || !syncReady || cashSession !== null) { setServerCajaOpen(null); return }
    let cancelled = false
    const check = () => {
      const ctrl = new AbortController()
      // Timeout generoso: solo cancela la petición, NO muestra el banner.
      const timer = setTimeout(() => ctrl.abort(), 8000)
      fetch(`/api/pos/cash-status?restaurantId=${restaurantId}`, { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          clearTimeout(timer)
          if (cancelled) return
          console.log('[POS cash-status]', JSON.stringify(d))
          setServerCajaOpen(d?.open === true ? true : (d?.open === false ? false : null))
        })
        .catch(() => {
          clearTimeout(timer)
          console.log('[POS cash-status] fetch error/timeout')
          // Error de red o timeout: dejamos null (no mostrar banner por incertidumbre)
        })
    }
    check()
    // Reintentar cada 15s mientras la caja siga sin verse abierta en Dexie.
    const t = setInterval(check, 15_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [restaurantId, syncReady, cashSession])

  // Desktop split-panel state
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel | null>(null)

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

  // Cerrar panel al cambiar a mobile
  useEffect(() => {
    if (!isDesktop) setDesktopPanel(null)
  }, [isDesktop])

  const [tab, setTab] = useState<Tab>('todos')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingModal, setPendingModal] = useState(false)
  const [mesaOpenModal, setMesaOpenModal] = useState<{ tableId: string; tableNumber: number; tableLabel: string } | null>(null)
  const [innerPage, setInnerPage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem('pos:restoreInnerPage')
    if (saved) { localStorage.removeItem('pos:restoreInnerPage'); return saved }
    return null
  })

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
    migrateLocalTablesToEvents(restaurantId)
    migrateLocalStaffToEvents(restaurantId)
    deduplicateStaff(restaurantId)
    purgeMirrorAccounts()
  })

  // Tab counts for badges
  const ocupadas = tables.filter(t => {
    const { status } = getTableStatus(t.id, accounts)
    return status !== 'libre'
  }).length

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

  // refreshOrdersRef se pasa a OrdersBoard que lo apunta a su fetchOrders interno.
  // PrepAlertWatcher y DelifastCancelWatcher lo usan para forzar un re-fetch.

  const totalOnline = orderCounts.retiro + orderCounts.delivery
  const tabCounts: Partial<Record<Tab, number>> = {
    ...(ocupadas > 0 ? { mesas: ocupadas } : {}),
    ...(orderCounts.retiro > 0 ? { retiro: orderCounts.retiro } : {}),
    ...(orderCounts.delivery > 0 ? { delivery: orderCounts.delivery } : {}),
    ...(totalOnline > 0 ? { todos: totalOnline } : {}),
  }

  // Handlers
  const handleMesaClick = (tableId: string, tableNumber: number, tableLabel?: string) => {
    const { status, accountId } = getTableStatus(tableId, accounts)
    if (status === 'libre') {
      setMesaOpenModal({ tableId, tableNumber, tableLabel: tableLabel ?? `Mesa ${tableNumber}` })
    } else if (accountId) {
      if (isDesktop) {
        setDesktopPanel({ type: 'cuenta', accountId, tab: 'mesas' })
      } else {
        navigate(`/pos/cuenta?id=${accountId}`)
      }
    }
  }

  const handleMesaConfirm = (covers: number, garzonName: string) => {
    if (!mesaOpenModal) return
    const id = uuidv4()
    openAccount({
      account_id: id,
      account_type: 'mesa',
      table_id: mesaOpenModal.tableId,
      table_number: mesaOpenModal.tableNumber,
      table_label: mesaOpenModal.tableLabel,
      covers,
      opened_by_name: garzonName || undefined,
    })
    setMesaOpenModal(null)
    if (isDesktop) {
      setDesktopPanel({ type: 'comandero', accountId: id, tab: 'mesas' })
    } else {
      navigate(`/pos/comandero?cuenta=${id}`)
    }
  }

  // Solo mostrar el panel si pertenece al tab activo
  const activePanel = desktopPanel?.tab === tab ? desktopPanel : null

  // ID de mesa activa en el panel desktop (para resaltarla visualmente)
  const activePanelAccountId = activePanel?.accountId ?? null
  const activePanelTableId = activePanelAccountId
    ? accounts.find(a => a.id === activePanelAccountId)?.table_id ?? null
    : null

  // Render de una tarjeta de mesa (reutilizado en vista plana y agrupada por sector)
  const renderMesaButton = (table: PosTable) => {
    const { status, accountId } = getTableStatus(table.id, accounts)
    const acc = accountId ? accounts.find(a => a.id === accountId) : undefined
    const isCuentaPedida = status === 'cuenta_pedida'
    const isActivePanel = isDesktop && activePanelTableId === table.id
    const tableLabel = table.label || String(table.number)
    return (
      <div key={table.id} className={`pos-mesa-cell ${status}`}>
        <button
          className={`pos-mesa ${status}${isActivePanel ? ' panel-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); handleMesaClick(table.id, table.number, table.label) }}
        >
          {/* Número/label de la mesa — siempre visible, grande, dentro del cuadrado */}
          <span className="pos-mesa-num">{tableLabel}</span>
          <div className="pos-mesa-center">
            {status === 'libre' ? null : isCuentaPedida ? (
              <>
                {acc?.covers ? <span className="pos-mesa-covers"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>{acc.covers}</span> : null}
                <span className="ms">Cuenta</span>
              </>
            ) : acc ? (
              acc.covers ? <span className="pos-mesa-covers"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>{acc.covers}</span> : null
            ) : null}
          </div>
          {acc ? (
            <div className="pos-mesa-bottom">
              <span className="pos-mesa-time" style={{ width: '100%', display: 'inline-flex', justifyContent: 'center' }}><LiveClock since={acc.opened_at} icon={false} style={{ fontWeight: 'inherit', color: 'inherit' }} /></span>
            </div>
          ) : (
            <div className="pos-mesa-bottom">
              <span className="pos-mesa-time" style={{ width: '100%', textAlign: 'center', opacity: 0.5 }}>Libre</span>
            </div>
          )}
        </button>
        {acc?.opened_by_name && (
          <span className="pos-mesa-garzon" title={acc.opened_by_name}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>
            {acc.opened_by_name}
          </span>
        )}
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
      {/* Alerta global de retiro atascado en preparación (corre en todas las pestañas). */}
      {restaurantId && (
        <PrepAlertWatcher restaurantId={restaurantId} orders={activeOrders} prepAlertMinutes={prepAlertMin} readyAlertMinutes={readyAlertMin} onChanged={() => refreshOrdersRef.current()} />
      )}
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
        onBrandClick={() => { setTab('todos'); setInnerPage(null) }}
        centerSlot={
          <div className="pos-tabs-bar">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`pos-tab${tab === t.id && !innerPage ? ' on' : ''}`}
                onClick={() => { setTab(t.id); setInnerPage(null) }}
              >
                {t.label}
                {tabCounts[t.id] ? <span className="pos-tab-badge">{tabCounts[t.id]}</span> : null}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Selector de sucursal (solo cuando hay 2+ locales) ── */}
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

      {/* ── Caja cerrada — ribbon siempre visible ── */}
      {/* Se muestra solo cuando la caja está CERRADA confirmada: cashSession===null
          (no undefined=cargando) Y la primera sincronización del local terminó
          (syncReady). Así no parpadea en cada sync incremental ni al cambiar de
          sucursal (mientras sincroniza el nuevo local, syncReady=false → no se
          muestra el falso "caja cerrada"). */}
      {cashSession === null && syncReady && serverCajaOpen === false && (
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
          <span style={{ color: 'var(--amber-press)', fontWeight: 600, fontSize: 13, fontFamily: 'var(--sans)' }}>Caja cerrada</span>
          <button
            onClick={() => setInnerPage('caja')}
            style={{ border: 'none', background: 'var(--amber)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sans)' }}
          >
            Abrir caja →
          </button>
        </div>
      )}

      {/* ── Inner page (carta, caja, impresora, etc.) ── */}
      {innerPage && INNER_PAGES[innerPage] && (
        <>
          {React.createElement(INNER_PAGES[innerPage].component, { restaurantId, title: INNER_PAGES[innerPage].title, onDone: () => setInnerPage(null), allBranches })}
        </>
      )}

      {/* ── Main content (solo cuando no hay inner page) ── */}
      {!innerPage && <>

      {/* ── Retiro / Delivery / Todos ── */}
      {(tab === 'retiro' || tab === 'delivery' || tab === 'todos') && (
        <OrdersBoard restaurantId={restaurantId} type={tab} allBranches={allBranches} onOrdersUpdate={handleOrdersUpdate} refreshRef={refreshOrdersRef} />
      )}

      {/* ── Mesas en modo Todas: mensaje para seleccionar sucursal ── */}
      {tab === 'mesas' && effectiveBranchMode === 'todas' && (
        <div className="pos-empty" style={{ flex: 1, minHeight: 200 }}>
          <div className="ring">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          </div>
          <p>Selecciona una sucursal para ver las mesas.</p>
        </div>
      )}

      {/* ── Split layout: izquierda (mesas) + derecha (panel) ── */}
      {tab === 'mesas' && effectiveBranchMode !== 'todas' && (
      <div className="pos-split-wrapper" style={isDesktop ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' } : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Lista de mesas (columna izquierda en desktop) ──────────── */}
      <div className={isDesktop ? 'pos-split-left pos-scroll' : 'pos-scroll'} onClick={isDesktop ? () => setDesktopPanel(null) : undefined}>
        <div className="pos-pad">

            {/* MESAS */}
          {tab === 'mesas' && (() => {
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

      {/* ── Panel detalle (columna derecha en desktop) ────────────────────── */}
      {isDesktop && (
        <div className={`pos-split-right${activePanel ? '' : ' empty'}`}>
          {activePanel?.type === 'cuenta' && (
            <CuentaPanel
              accountId={activePanel.accountId}
              fromTab={tab}
              isPanel
              onClose={() => setDesktopPanel(null)}
              onGoToComandero={(id) => setDesktopPanel({ type: 'comandero', accountId: id, tab })}
            />
          )}
          {activePanel?.type === 'comandero' && (
            <ComanderoPanel
              accountId={activePanel.accountId}
              isPanel
              onClose={() => setDesktopPanel(null)}
              onBack={() => activePanel.accountId
                ? setDesktopPanel({ type: 'cuenta', accountId: activePanel.accountId, tab })
                : setDesktopPanel(null)
              }
            />
          )}
          {!activePanel && (
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
      {mesaOpenModal && (
        <MesaOpenModal
          tableLabel={mesaOpenModal.tableLabel}
          garzones={garzones}
          onClose={() => setMesaOpenModal(null)}
          onConfirm={handleMesaConfirm}
        />
      )}

      </>}{/* /!innerPage */}

      {/* ── Drawer ── */}
      {menuOpen && <PosMenuDrawer cashSession={!!cashSession} restaurant={restaurant} onClose={() => setMenuOpen(false)} onNavigate={navigate} onInline={setInnerPage} />}
    </div>
  )
}

