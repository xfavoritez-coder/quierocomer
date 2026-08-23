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

type Tab = 'mesas' | 'retiro' | 'delivery'
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
  { id: 'retiro', label: 'Retiros' },
  { id: 'delivery', label: 'Delivery' },
]

// ── Modals ────────────────────────────────────────────────────────

function RetiroModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (name: string, time: string) => void }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-title">Nuevo retiro</div>
        <label className="pos-modal-label">Nombre del cliente <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
        <input
          autoFocus
          className="pos-modal-input"
          placeholder="Ej: Juan"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm(name.trim(), time)}
        />
        <label className="pos-modal-label">Hora de retiro <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
        <input
          className="pos-modal-input"
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <div className="pos-modal-actions">
          <button className="pos-modal-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="pos-modal-ok"
            onClick={() => onConfirm(name.trim(), time)}
          >
            Crear pedido
          </button>
        </div>
      </div>
    </div>
  )
}

function DeliveryModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (data: { name: string; phone: string; address: string; notes: string }) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const valid = name.trim() && phone.trim() && address.trim()
  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-title">Nuevo delivery</div>
        <label className="pos-modal-label">Nombre del cliente</label>
        <input autoFocus className="pos-modal-input" placeholder="Ej: María González" value={name} onChange={e => setName(e.target.value)} />
        <label className="pos-modal-label">Teléfono</label>
        <input className="pos-modal-input" placeholder="+56 9 1234 5678" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        <label className="pos-modal-label">Dirección de entrega</label>
        <input className="pos-modal-input" placeholder="Calle y número, barrio..." value={address} onChange={e => setAddress(e.target.value)} />
        <label className="pos-modal-label">Notas (opcional)</label>
        <input className="pos-modal-input" placeholder="Depto, referencias, sin gluten..." value={notes} onChange={e => setNotes(e.target.value)} />
        <div className="pos-modal-actions">
          <button className="pos-modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="pos-modal-ok" disabled={!valid} onClick={() => onConfirm({ name: name.trim(), phone: phone.trim(), address: address.trim(), notes: notes.trim() })}>
            Crear delivery
          </button>
        </div>
      </div>
    </div>
  )
}

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

// ── Account cards (Mostrador / Retiro / Delivery) ─────────────────

function AccountCard({ account, onSelect }: { account: Account; onSelect: (accountId: string) => void }) {
  const isActive = account.total > 0
  const isDelivery = account.type === 'delivery'
  const typeLabel = isDelivery ? 'Delivery' : 'Retiro'
  const chipClass = isActive ? 'on' : isDelivery ? 'de' : 're'

  return (
    <button
      className={`pos-ticket ${isActive ? 'active' : 'idle'}`}
      onClick={() => onSelect(account.id)}
    >
      <div className="pos-rail" />
      <div className="pos-ticket-body">
        <div className="pos-t-left">
          <div className={`pos-chip ${chipClass}`}>{typeLabel}</div>
          <div>
            <div className="pos-t-name">
              {account.type === 'delivery'
                ? `Delivery · ${account.customer_name}`
                : account.customer_name
                  ? `Retiro · ${account.customer_name}`
                  : 'Retiro'}
            </div>
            {account.delivery_address && (
              <div className="pos-t-address">{account.delivery_address}</div>
            )}
            <div className="pos-t-meta">
              <span>{account.items.filter(i => !i.voided).length} ítems</span>
              <span className="sep">·</span>
              <span>{account.rounds.length} ronda{account.rounds.length !== 1 ? 's' : ''}</span>
              <span className="sep">·</span>
              <span>{timeSince(account.opened_at)}</span>
            </div>
          </div>
        </div>
        <div className={`pos-t-total ${account.total === 0 ? 'zero' : 'big'}`}>
          ${account.total.toLocaleString('es-CL')}
        </div>
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────

type DesktopPanel =
  | { type: 'cuenta'; accountId: string; tab: Tab }
  | { type: 'comandero'; accountId: string | null; tab: Tab }

export default function PosHomePage() {
  const navigate = usePosNav()
  const isDesktop = useIsDesktop()
  const { restaurantId, restaurant } = usePosRestaurant()
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

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab') as Tab | null
      if (p && ['mesas', 'retiro', 'delivery'].includes(p)) return p
    }
    return 'mesas'
  })
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [retiroModal, setRetiroModal] = useState(false)
  const [deliveryModal, setDeliveryModal] = useState(false)
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
  const openAccounts = accounts.filter(a => !['cerrada', 'anulada'].includes(a.status))
  const retiroAccounts = openAccounts.filter(a => a.type === 'retiro' || a.type === 'mostrador')
  const deliveryAccounts = openAccounts.filter(a => a.type === 'delivery')
  const ocupadas = tables.filter(t => {
    const { status } = getTableStatus(t.id, accounts)
    return status !== 'libre'
  }).length

  const tabCounts: Partial<Record<Tab, number>> = {
    ...(ocupadas > 0 ? { mesas: ocupadas } : {}),
    ...(retiroAccounts.length > 0 ? { retiro: retiroAccounts.length } : {}),
    ...(deliveryAccounts.length > 0 ? { delivery: deliveryAccounts.length } : {}),
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

  const handleSelectAccount = (accountId: string) => {
    if (isDesktop) {
      setDesktopPanel({ type: 'cuenta', accountId, tab })
    } else {
      navigate(`/pos/cuenta?id=${accountId}&from=${tab}`)
    }
  }

  const handleNewRetiro = (name: string, time: string) => {
    setRetiroModal(false)
    const id = uuidv4()
    if (name) {
      openAccount({ account_id: id, account_type: 'retiro', customer_name: name, pickup_time: time || undefined })
    } else {
      openAccount({ account_id: id, account_type: 'mostrador' })
    }
    if (isDesktop) {
      setDesktopPanel({ type: 'cuenta', accountId: id, tab: 'retiro' })
    } else {
      navigate(`/pos/cuenta?id=${id}&from=retiro`)
    }
  }

  const handleNewDelivery = (data: { name: string; phone: string; address: string; notes: string }) => {
    setDeliveryModal(false)
    const id = uuidv4()
    openAccount({
      account_id: id,
      account_type: 'delivery',
      customer_name: data.name,
      customer_phone: data.phone,
      delivery_address: data.address,
    })
    if (isDesktop) {
      setDesktopPanel({ type: 'cuenta', accountId: id, tab: 'delivery' })
    } else {
      navigate(`/pos/cuenta?id=${id}&from=delivery`)
    }
  }

  // Solo mostrar el panel si pertenece al tab activo
  const activePanel = desktopPanel?.tab === tab ? desktopPanel : null

  // ID de mesa activa en el panel desktop (para resaltarla visualmente)
  const activePanelAccountId = activePanel?.accountId ?? null
  const activePanelTableId = activePanelAccountId
    ? accounts.find(a => a.id === activePanelAccountId)?.table_id ?? null
    : null

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
          </div>
        }
      />

      {/* ── Split layout: izquierda (mesas) + derecha (panel) ── */}
      <div className="pos-split-wrapper" style={isDesktop ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' } : { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Content (columna izquierda en desktop) ──────────── */}
      <div className={isDesktop ? 'pos-split-left pos-scroll' : 'pos-scroll'}>
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
                        onClick={() => handleMesaClick(table.id, table.number, table.label)}
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

          {/* RETIRO */}
          {tab === 'retiro' && (
            <>
              <div className="pos-tab-header">
                <div className="pos-tab-stat">
                  <span className="pos-tab-stat-n">{retiroAccounts.length}</span>
                  <span className="pos-tab-stat-l">retiro{retiroAccounts.length !== 1 ? 's' : ''} activo{retiroAccounts.length !== 1 ? 's' : ''}</span>
                </div>
                <button className="pos-new-btn-sm" onClick={() => setRetiroModal(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Nuevo retiro
                </button>
              </div>
              {retiroAccounts.length > 0 ? (
                <div className="pos-tickets">
                  {[...retiroAccounts.filter(a => a.total > 0), ...retiroAccounts.filter(a => a.total === 0)]
                    .map(a => <AccountCard key={a.id} account={a} onSelect={handleSelectAccount} />)}
                </div>
              ) : (
                <div className="pos-empty" style={{ minHeight: 160 }}>
                  <p>Sin pedidos pendientes</p>
                </div>
              )}
            </>
          )}

          {/* DELIVERY */}
          {tab === 'delivery' && (
            <>
              <div className="pos-tab-header">
                <div className="pos-tab-stat">
                  <span className="pos-tab-stat-n">{deliveryAccounts.length}</span>
                  <span className="pos-tab-stat-l">delivery{deliveryAccounts.length !== 1 ? 's' : ''} activo{deliveryAccounts.length !== 1 ? 's' : ''}</span>
                </div>
                <button className="pos-new-btn-sm" onClick={() => setDeliveryModal(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Nuevo delivery
                </button>
              </div>
              {deliveryAccounts.length > 0 ? (
                <div className="pos-tickets">
                  {[...deliveryAccounts.filter(a => a.total > 0), ...deliveryAccounts.filter(a => a.total === 0)]
                    .map(a => <AccountCard key={a.id} account={a} onSelect={handleSelectAccount} />)}
                </div>
              ) : (
                <div className="pos-empty" style={{ minHeight: 160 }}>
                  <p>Sin deliveries pendientes</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Panel derecho (solo desktop) ────────────────────── */}
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
                {tab === 'mesas' && <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>}
                {tab === 'retiro' && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}
                {tab === 'delivery' && <><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><circle cx="20" cy="16" r="1"/></>}
              </svg>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {tab === 'mesas' ? 'Selecciona una mesa' : tab === 'retiro' ? 'Selecciona un retiro' : 'Selecciona un delivery'}
              </span>
            </div>
          )}
        </div>
      )}

      </div>{/* /pos-split-wrapper */}

      {/* ── Modals ──────────────────────────────────────────── */}
      {retiroModal && <RetiroModal onClose={() => setRetiroModal(false)} onConfirm={handleNewRetiro} />}
      {deliveryModal && <DeliveryModal onClose={() => setDeliveryModal(false)} onConfirm={handleNewDelivery} />}
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
