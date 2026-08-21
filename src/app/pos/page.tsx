'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import {
  usePosSync,
  useOpenAccounts,
  useOpenCashSession,
  setRestaurantId,
  setUserId,
  openAccount,
} from '@/lib/pos'
import PosHeader from './components/PosHeader'

const TEST_RESTAURANT_ID = 'cmo22e53z0000l404vsw2cksk'
const TEST_USER_ID = 'test-garzon'

export default function PosHomePage() {
  const router = useRouter()
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const accounts = useOpenAccounts()
  const cashSession = useOpenCashSession()

  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  const activeAccounts = accounts.filter(a => a.total > 0)
  const idleAccounts = accounts.filter(a => a.total === 0)
  const sortedAccounts = [...activeAccounts, ...idleAccounts]

  const handleMostrador = async () => {
    const id = uuidv4()
    await openAccount({ account_id: id, account_type: 'mostrador' })
    router.push(`/pos/comandero?cuenta=${id}`)
  }

  const handleRetiro = async () => {
    const id = uuidv4()
    await openAccount({ account_id: id, account_type: 'retiro', customer_name: 'Cliente' })
    router.push(`/pos/comandero?cuenta=${id}`)
  }

  const handleNewOrder = () => {
    router.push('/pos/comandero')
  }

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
            <button className="pos-act primary" onClick={handleNewOrder}>
              <span className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a3 3 0 0 1 6 0v1M9 11h6M9 15h4"/></svg>
              </span>
              <span className="lb">Comandero</span>
            </button>
            <button className="pos-act" onClick={() => router.push('/pos/config')}>
              <span className="ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 0-1.41-1.41M5.34 5.34A10 10 0 0 0 4.93 6.7M4.93 17.3a10 10 0 0 0 1.41 1.41M18.66 18.66A10 10 0 0 0 19.07 17M20 12h1M3 12H2M12 20v1M12 3V2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"/></svg>
              </span>
              <span className="lb">Impresora</span>
            </button>
          </div>

          {/* ── Open accounts ──────────────────────────── */}
          <div className="pos-eyebrow">
            Cuentas abiertas {accounts.length > 0 && (
              <b>· {accounts.length}</b>
            )}
          </div>

          {sortedAccounts.length > 0 ? (
            <div className="pos-tickets">
              {sortedAccounts.map(account => {
                const isActive = account.total > 0
                const chipLabel = account.type === 'mesa'
                  ? String(account.table_number || 'M')
                  : account.type === 'mostrador' ? 'MO' : 'RE'
                const chipClass = isActive
                  ? 'on'
                  : account.type === 'mostrador' ? 'mo' : 're'

                return (
                  <button
                    key={account.id}
                    className={`pos-ticket ${isActive ? 'active' : 'idle'}`}
                    onClick={() => router.push(`/pos/comandero?cuenta=${account.id}`)}
                  >
                    <div className="pos-rail" />
                    <div className="pos-ticket-body">
                      <div className="pos-t-left">
                        <div className={`pos-chip ${chipClass}`}>
                          {chipLabel}
                        </div>
                        <div>
                          <div className="pos-t-name">
                            {account.type === 'mesa'
                              ? `Mesa ${account.table_number}`
                              : account.type === 'mostrador'
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
          ) : (
            <div className="pos-empty">
              <div className="ring">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
              <p>
                Sin cuentas abiertas. Toca Mostrador, Retiro o Comandero para empezar.
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
