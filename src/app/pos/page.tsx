'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import {
  usePosSync,
  useOpenAccounts,
  useOpenCashSession,
  useTables,
  setRestaurantId,
  setUserId,
  openAccount,
} from '@/lib/pos'
import type { Account } from '@/lib/pos'
import PosHeader from './components/PosHeader'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

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

export default function PosHomePage() {
  const router = useRouter()
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const accounts = useOpenAccounts()
  const cashSession = useOpenCashSession()
  const tables = useTables(TEST_RESTAURANT_ID)

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  const handleMostrador = () => {
    const id = uuidv4()
    router.push(`/pos/cuenta?id=${id}`)
    openAccount({ account_id: id, account_type: 'mostrador' })
  }

  const handleRetiro = () => {
    const id = uuidv4()
    router.push(`/pos/cuenta?id=${id}`)
    openAccount({ account_id: id, account_type: 'retiro', customer_name: 'Cliente' })
  }

  const handleMesaClick = (tableId: string, tableNumber: number) => {
    const { status, accountId } = getTableStatus(tableId, accounts)
    if (status === 'libre') {
      const id = uuidv4()
      router.push(`/pos/cuenta?id=${id}`)
      openAccount({ account_id: id, account_type: 'mesa', table_id: tableId, table_number: tableNumber })
    } else if (accountId) {
      router.push(`/pos/cuenta?id=${accountId}`)
    }
  }

  // Mostrador y retiro abiertos (no mesa)
  const nonMesaAccounts = accounts.filter(a => a.type !== 'mesa')
  const sortedNonMesa = [...nonMesaAccounts.filter(a => a.total > 0), ...nonMesaAccounts.filter(a => a.total === 0)]

  return (
    <div className="pos-shell">
      <PosHeader
        mode="brand"
        syncing={syncing}
        rightSlot={cashSession && (
          <div className="pos-caja-info">
            <span className="who">JC</span>
            Caja abierta
          </div>
        )}
      />

      <div className="pos-scroll">
        <div className="pos-pad">

          {/* ── Action cards ──────────────────────────── */}
          <div className="pos-actions">
            <button className="pos-act" onClick={handleMostrador}>
              <span className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>
              </span>
              <span className="lb">Mostrador</span>
            </button>
            <button className="pos-act" onClick={handleRetiro}>
              <span className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
              </span>
              <span className="lb">Retiro</span>
            </button>
            <button className="pos-act" onClick={() => router.push('/pos/config')}>
              <span className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 0-1.41-1.41M5.34 5.34A10 10 0 0 0 4.93 6.7M4.93 17.3a10 10 0 0 0 1.41 1.41M18.66 18.66A10 10 0 0 0 19.07 17M20 12h1M3 12H2M12 20v1M12 3V2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"/></svg>
              </span>
              <span className="lb">Impresora</span>
            </button>
            <button className="pos-act" onClick={() => router.push('/pos/config/mesas')}>
              <span className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              </span>
              <span className="lb">Mesas</span>
            </button>
          </div>

          {/* ── Mesa grid ──────────────────────────── */}
          {tables.length > 0 ? (
            <>
              <div className="pos-eyebrow">
                Mesas <b>· {tables.length}</b>
              </div>
              <div className="pos-mesa-grid">
                {tables.map(table => {
                  const { status, accountId } = getTableStatus(table.id, accounts)
                  const acc = accountId ? accounts.find(a => a.id === accountId) : undefined
                  return (
                    <button
                      key={table.id}
                      className={`pos-mesa ${status}`}
                      onClick={() => handleMesaClick(table.id, table.number)}
                    >
                      <span className="mn">{table.number}</span>
                      <span className="ms">{statusLabel[status]}</span>
                      {acc && acc.total > 0 && (
                        <span className="mt">${acc.total.toLocaleString('es-CL')}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="pos-eyebrow">Mesas</div>
              <div className="pos-empty" style={{ minHeight: 100, marginBottom: 26 }}>
                <div className="ring">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                </div>
                <p>
                  Sin mesas configuradas.{' '}
                  <button
                    onClick={() => router.push('/pos/config/mesas')}
                    style={{ color: 'var(--amber-press)', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
                  >
                    Configurar mesas
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── Mostrador / retiro abiertos ──────────────────────────── */}
          {sortedNonMesa.length > 0 && (
            <>
              <div className="pos-eyebrow">
                Mostrador / Retiro {sortedNonMesa.length > 0 && <b>· {sortedNonMesa.length}</b>}
              </div>
              <div className="pos-tickets">
                {sortedNonMesa.map(account => {
                  const isActive = account.total > 0
                  const chipLabel = account.type === 'mostrador' ? 'MO' : 'RE'
                  const chipClass = isActive ? 'on' : account.type === 'mostrador' ? 'mo' : 're'

                  return (
                    <button
                      key={account.id}
                      className={`pos-ticket ${isActive ? 'active' : 'idle'}`}
                      onClick={() => router.push(`/pos/cuenta/${account.id}`)}
                    >
                      <div className="pos-rail" />
                      <div className="pos-ticket-body">
                        <div className="pos-t-left">
                          <div className={`pos-chip ${chipClass}`}>
                            {chipLabel}
                          </div>
                          <div>
                            <div className="pos-t-name">
                              {account.type === 'mostrador'
                                ? 'Mostrador'
                                : `Retiro · ${account.customer_name}`
                              }
                            </div>
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
                })}
              </div>
            </>
          )}

          {tables.length === 0 && sortedNonMesa.length === 0 && (
            <div className="pos-empty" style={{ marginTop: 16 }}>
              <div className="ring">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <p>
                Sin cuentas abiertas. Toca Mostrador o Retiro para empezar.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────────── */

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}
