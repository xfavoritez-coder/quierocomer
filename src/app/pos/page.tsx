'use client'

import { useState, useEffect } from 'react'
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
} from '@/lib/pos'
import type { Account, PosStaff } from '@/lib/pos'
import PosHeader from './components/PosHeader'
import { usePosNav } from './lib/usePosNav'
import { usePosRestaurant } from './lib/usePosRestaurant'
import type { PosRestaurant } from './lib/usePosRestaurant'
import { useIsDesktop } from './lib/useIsDesktop'
import CuentaPanel from './components/CuentaPanel'
import ComanderoPanel from './components/ComanderoPanel'

const TEST_USER_ID = 'pos-garzon'

type Tab = 'mesas'
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

function PosMenuDrawer({ cashSession, restaurant, onClose, onNavigate }: { cashSession: boolean; restaurant: PosRestaurant | null; onClose: () => void; onNavigate: (url: string) => void }) {
  const items = [
    {
      label: cashSession ? 'Ver caja' : 'Abrir caja',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 11h18M7 15h3"/></svg>,
      href: '/pos/caja',
    },
    {
      label: 'Configurar mesas',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
      href: '/pos/config/mesas',
    },
    {
      label: 'Garzones',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
      href: '/pos/config/garzones',
    },
    {
      label: 'Impresora',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="3" width="12" height="6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 14H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/></svg>,
      href: '/pos/config',
    },
  ]

  return (
    <>
      <div className="pos-drawer-overlay" onClick={onClose} />
      <div className="pos-drawer">
        {/* Restaurant info header */}
        {restaurant && (
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--amber-tint)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {restaurant.logoUrl
                  ? <img src={restaurant.logoUrl} alt={restaurant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--amber-press)' }}>{restaurant.name.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>POS · {restaurant.slug}</div>
              </div>
            </div>
          </div>
        )}
        <div className="pos-drawer-header" style={restaurant ? { borderBottom: 0, paddingTop: 12, paddingBottom: 8 } : undefined}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Ajustes</span>
          <button onClick={onClose} className="pos-drawer-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="pos-drawer-items">
          {items.map(item => (
            <button
              key={item.label}
              className="pos-drawer-item"
              onClick={() => { onClose(); onNavigate(item.href) }}
            >
              <span className="pos-drawer-ic">{item.icon}</span>
              <span>{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────

type DesktopPanel =
  | { type: 'cuenta'; accountId: string; tab: Tab }
  | { type: 'comandero'; accountId: string | null; tab: Tab }

export default function PosHomePage() {
  const navigate = usePosNav()
  const isDesktop = useIsDesktop()
  const { restaurantId, restaurant, posEnabled } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const accounts = useOpenAccounts()
  const cashSession = useOpenCashSession()
  const tables = useTables(restaurantId)
  const sectors = useSectors(restaurantId)
  const garzones = useStaff(restaurantId)
  const pendingCount = usePendingSyncCount()

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

  const [tab, setTab] = useState<Tab>('mesas')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingModal, setPendingModal] = useState(false)
  const [mesaOpenModal, setMesaOpenModal] = useState<{ tableId: string; tableNumber: number; tableLabel: string } | null>(null)

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
    migrateLocalTablesToEvents(restaurantId)
    migrateLocalStaffToEvents(restaurantId)
    deduplicateStaff(restaurantId)
  })

  // Tab counts for badges
  const ocupadas = tables.filter(t => {
    const { status } = getTableStatus(t.id, accounts)
    return status !== 'libre'
  }).length

  const tabCounts: Partial<Record<Tab, number>> = {
    ...(ocupadas > 0 ? { mesas: ocupadas } : {}),
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
      <PosHeader
        mode="brand"
        syncing={syncing}
        onMenu={() => setMenuOpen(true)}
        onPendingClick={() => setPendingModal(true)}
        onBrandClick={() => setTab('mesas')}
        centerSlot={
          <div className="pos-tabs-bar">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`pos-tab${tab === t.id ? ' on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {tabCounts[t.id] ? <span className="pos-tab-badge">{tabCounts[t.id]}</span> : null}
              </button>
            ))}
            <button
              className="pos-tab pos-tab-order"
              onClick={() => navigate('/pos/tomar-pedido')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--amber)', color: '#fff', fontWeight: 700 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Tomar Pedido
            </button>
          </div>
        }
      />

      {/* ── Split layout: izquierda (mesas) + derecha (panel) ── */}
      <div className="pos-split-wrapper" style={isDesktop ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '420px 1fr', overflow: 'hidden' } : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Content (mesas: columna DERECHA en desktop; el panel va a la izquierda) ──────────── */}
      <div className={isDesktop ? 'pos-split-left pos-scroll' : 'pos-scroll'} style={isDesktop ? { order: 2 } : undefined} onClick={isDesktop ? () => setDesktopPanel(null) : undefined}>
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
                {/* Sector pills */}
                {sectors.length > 0 && (
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
                <div className="pos-mesa-grid">
                  {filteredTables.map(table => {
                    const { status, accountId } = getTableStatus(table.id, accounts)
                    const acc = accountId ? accounts.find(a => a.id === accountId) : undefined
                    const itemCount = acc ? acc.items.filter(i => !i.voided).length : 0
                    const isCuentaPedida = status === 'cuenta_pedida'
                    const isActivePanel = isDesktop && activePanelTableId === table.id
                    return (
                      <button
                        key={table.id}
                        className={`pos-mesa ${status}${isActivePanel ? ' panel-active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleMesaClick(table.id, table.number, table.label) }}
                      >
                        <span className="mn">{table.label || table.number}</span>
                        <div className="pos-mesa-center">
                          {status === 'libre' ? (
                            <span className="ms">Libre</span>
                          ) : isCuentaPedida ? (
                            <>
                              {acc?.covers ? <span className="pos-mesa-covers"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>{acc.covers}</span> : null}
                              <span className="ms">Pidió cuenta</span>
                            </>
                          ) : acc ? (
                            acc.covers ? <span className="pos-mesa-covers"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M20 20c0-4.418-3.582-8-8-8s-8 3.582-8 8h16z"/></svg>{acc.covers}</span> : <span className="ms">Tomada</span>
                          ) : null}
                        </div>
                        {acc && (
                          <div className="pos-mesa-bottom">
                            <span className="pos-mesa-time" style={{width:'100%',textAlign:'center'}}>{timeSince(acc.opened_at)}</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                  {filteredTables.length === 0 && (
                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '20px 0' }}>
                      Sin mesas en este sector
                    </p>
                  )}
                </div>
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

      {/* ── Panel derecho (solo desktop) ────────────────────── */}
      {isDesktop && (
        <div className={`pos-split-right${activePanel ? '' : ' empty'}`} style={{ order: 1 }}>
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

      </div>{/* /pos-split-wrapper */}

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

      {/* ── Drawer ──────────────────────────────────────────── */}
      {menuOpen && <PosMenuDrawer cashSession={!!cashSession} restaurant={restaurant} onClose={() => setMenuOpen(false)} onNavigate={navigate} />}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}
