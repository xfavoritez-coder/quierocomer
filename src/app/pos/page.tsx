'use client'

import { useState } from 'react'
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
  seedDefaultGarzones,
} from '@/lib/pos'
import type { Account, PosStaff } from '@/lib/pos'
import PosHeader from './components/PosHeader'
import { usePosNav } from './lib/usePosNav'
import { usePosRestaurant } from './lib/usePosRestaurant'
import type { PosRestaurant } from './lib/usePosRestaurant'

const TEST_USER_ID = 'pos-garzon'

type Tab = 'todos' | 'mesas' | 'retiro' | 'delivery' | 'online'
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
  { id: 'retiro', label: 'Para llevar' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'online', label: 'Online' },
]

// ── Modals ────────────────────────────────────────────────────────

function RetiroModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (name: string, time: string) => void }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-title">Nuevo retiro</div>
        <label className="pos-modal-label">Nombre del cliente</label>
        <input
          autoFocus
          className="pos-modal-input"
          placeholder="Ej: Juan"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim(), time)}
        />
        <label className="pos-modal-label">Hora de retiro (opcional)</label>
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
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim(), time)}
          >
            Crear retiro
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
      <div className="pos-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-modal-title">Abrir {tableLabel}</div>

        <label className="pos-modal-label">Comensales</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {QUICK.map(n => (
            <button
              key={n}
              onClick={() => setCovers(n)}
              style={{
                width: 44, height: 44, borderRadius: 10, border: covers === n ? 0 : '1px solid var(--line)',
                background: covers === n ? 'var(--amber)' : 'var(--sunk)',
                color: covers === n ? '#fff' : 'var(--ink-2)',
                fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >{n}</button>
          ))}
          <input
            type="number" min={1} max={50}
            value={covers > 8 ? covers : ''}
            placeholder="9+"
            onChange={e => { const v = parseInt(e.target.value); if (v > 0) setCovers(v) }}
            style={{ width: 56, height: 44, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--sunk)', fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink)', textAlign: 'center', outline: 'none' }}
          />
        </div>

        {garzones.length > 0 && (
          <>
            <label className="pos-modal-label">Garzón</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {garzones.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGarzon(g.name)}
                  style={{
                    padding: '10px 16px', borderRadius: 10, border: garzon === g.name ? 0 : '1px solid var(--line)',
                    background: garzon === g.name ? 'var(--amber)' : 'var(--sunk)',
                    color: garzon === g.name ? '#fff' : 'var(--ink-2)',
                    fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--sans)',
                  }}
                >{g.name}</button>
              ))}
            </div>
          </>
        )}

        <div className="pos-modal-actions">
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
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--amber-tint)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--amber-press)' }}>
                  {restaurant.name.charAt(0).toUpperCase()}
                </span>
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

function AccountCard({ account, onNavigate }: { account: Account; onNavigate: (url: string) => void }) {
  const isActive = account.total > 0
  const typeLabel = account.type === 'mostrador' ? 'MO' : account.type === 'retiro' ? 'RE' : 'DE'
  const chipClass = isActive ? 'on' : account.type === 'mostrador' ? 'mo' : account.type === 'retiro' ? 're' : 'de'

  return (
    <button
      className={`pos-ticket ${isActive ? 'active' : 'idle'}`}
      onClick={() => onNavigate(`/pos/cuenta?id=${account.id}`)}
    >
      <div className="pos-rail" />
      <div className="pos-ticket-body">
        <div className="pos-t-left">
          <div className={`pos-chip ${chipClass}`}>{typeLabel}</div>
          <div>
            <div className="pos-t-name">
              {account.type === 'mostrador'
                ? 'Mostrador'
                : account.type === 'retiro'
                  ? `Retiro · ${account.customer_name}`
                  : `Delivery · ${account.customer_name}`}
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

export default function PosHomePage() {
  const navigate = usePosNav()
  const { restaurantId, restaurant } = usePosRestaurant()
  const { syncing } = usePosSync(restaurantId)
  const accounts = useOpenAccounts()
  const cashSession = useOpenCashSession()
  const tables = useTables(restaurantId)
  const sectors = useSectors(restaurantId)
  const garzones = useStaff(restaurantId)
  const pendingCount = usePendingSyncCount()

  const [tab, setTab] = useState<Tab>('mesas')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [retiroModal, setRetiroModal] = useState(false)
  const [deliveryModal, setDeliveryModal] = useState(false)
  const [pendingModal, setPendingModal] = useState(false)
  const [mesaOpenModal, setMesaOpenModal] = useState<{ tableId: string; tableNumber: number; tableLabel: string } | null>(null)

  useState(() => {
    setRestaurantId(restaurantId)
    setUserId(TEST_USER_ID)
    seedDefaultGarzones(restaurantId)
  })

  // Tab counts for badges
  const openAccounts = accounts.filter(a => !['cerrada', 'anulada'].includes(a.status))
  const retiroAccounts = accounts.filter(a => a.type === 'retiro' || a.type === 'mostrador')
  const deliveryAccounts = accounts.filter(a => a.type === 'delivery')

  const tabCounts: Partial<Record<Tab, number>> = {
    todos: openAccounts.length,
    retiro: retiroAccounts.length,
    delivery: deliveryAccounts.length,
  }

  // Handlers
  const handleMesaClick = (tableId: string, tableNumber: number, tableLabel?: string) => {
    const { status, accountId } = getTableStatus(tableId, accounts)
    if (status === 'libre') {
      setMesaOpenModal({ tableId, tableNumber, tableLabel: tableLabel ?? `Mesa ${tableNumber}` })
    } else if (accountId) {
      navigate(`/pos/cuenta?id=${accountId}`)
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
    navigate(`/pos/comandero?cuenta=${id}`)
  }

  const handleNewMostrador = () => {
    const id = uuidv4()
    openAccount({ account_id: id, account_type: 'mostrador' })
    navigate(`/pos/cuenta?id=${id}`)
  }

  const handleNewRetiro = (name: string, time: string) => {
    setRetiroModal(false)
    const id = uuidv4()
    openAccount({ account_id: id, account_type: 'retiro', customer_name: name, pickup_time: time || undefined })
    navigate(`/pos/cuenta?id=${id}`)
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
    navigate(`/pos/cuenta?id=${id}`)
  }

  return (
    <div className="pos-shell">
      <PosHeader
        mode="brand"
        syncing={syncing}
        onMenu={() => setMenuOpen(true)}
        onPendingClick={() => setPendingModal(true)}
      />

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div className="pos-tabs">
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

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="pos-scroll">
        <div className="pos-pad">

          {/* TODOS */}
          {tab === 'todos' && (
            openAccounts.length === 0 ? (
              <div className="pos-empty" style={{ minHeight: 200 }}>
                <div className="ring">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
                </div>
                <p>Sin cuentas abiertas</p>
              </div>
            ) : (
              <div className="pos-tickets">
                {[...openAccounts].sort((a, b) => a.opened_at.localeCompare(b.opened_at)).map(a => (
                  <AccountCard key={a.id} account={a} onNavigate={navigate} />
                ))}
              </div>
            )
          )}

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
                    return (
                      <button
                        key={table.id}
                        className={`pos-mesa ${status}`}
                        onClick={() => handleMesaClick(table.id, table.number, table.label)}
                      >
                        <span className="mn">{table.label || table.number}</span>
                        {acc && acc.items.filter(i => !i.voided).length > 0 ? (
                          <>
                            <span className="ms">{acc.items.filter(i => !i.voided).length} ítem{acc.items.filter(i => !i.voided).length !== 1 ? 's' : ''}</span>
                            <span className="mt">${acc.total.toLocaleString('es-CL')}</span>
                          </>
                        ) : (
                          <span className="ms">{statusLabel[status]}</span>
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
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button className="pos-new-btn" style={{ marginBottom: 0 }} onClick={handleNewMostrador}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  Mostrador
                </button>
                <button className="pos-new-btn" style={{ marginBottom: 0 }} onClick={() => setRetiroModal(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  Retiro
                </button>
              </div>
              {retiroAccounts.length > 0 ? (
                <div className="pos-tickets">
                  {[...retiroAccounts.filter(a => a.total > 0), ...retiroAccounts.filter(a => a.total === 0)]
                    .map(a => <AccountCard key={a.id} account={a} onNavigate={navigate} />)}
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
              <button className="pos-new-btn" onClick={() => setDeliveryModal(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                Nuevo delivery
              </button>
              {deliveryAccounts.length > 0 ? (
                <div className="pos-tickets">
                  {[...deliveryAccounts.filter(a => a.total > 0), ...deliveryAccounts.filter(a => a.total === 0)]
                    .map(a => <AccountCard key={a.id} account={a} onNavigate={navigate} />)}
                </div>
              ) : (
                <div className="pos-empty" style={{ minHeight: 160 }}>
                  <p>Sin deliveries pendientes</p>
                </div>
              )}
            </>
          )}

          {/* ONLINE */}
          {tab === 'online' && (
            <div className="pos-empty" style={{ minHeight: 200 }}>
              <div className="ring">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
              </div>
              <p>Pedidos online — próximamente</p>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
                Los pedidos de tu web llegarán aquí automáticamente.
              </p>
            </div>
          )}

        </div>
      </div>

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
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}
