'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import {
  useOnlineStatus,
  usePosSync,
  usePendingSyncCount,
  useOpenAccounts,
  useOpenCashSession,
  setRestaurantId,
  setUserId,
  openAccount,
} from '@/lib/pos'
import PosHeader from './components/PosHeader'

// TODO: will come from auth/context
const TEST_RESTAURANT_ID = 'test-restaurant'
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

  const mesaAccounts = accounts.filter(a => a.type === 'mesa')
  const otherAccounts = accounts.filter(a => a.type !== 'mesa')

  // ── Quick actions ──────────────────────────────────────────────

  const handleMostrador = async () => {
    const id = uuidv4()
    await openAccount({ account_id: id, account_type: 'mostrador' })
    router.push(`/pos/comandero?cuenta=${id}`)
  }

  const handleRetiro = async () => {
    // TODO: modal for name + pickup time
    const id = uuidv4()
    await openAccount({
      account_id: id,
      account_type: 'retiro',
      customer_name: 'Cliente',
    })
    router.push(`/pos/comandero?cuenta=${id}`)
  }

  const handleNewOrder = () => {
    router.push('/pos/comandero')
  }

  return (
    <div className="h-dvh flex flex-col bg-stone-50/50">
      <PosHeader title="POS QuieroComer" syncing={syncing} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

          {/* ── Quick actions ────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <ActionCard
              label="Mostrador"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <path d="M9 12h6M12 9v6"/>
                </svg>
              }
              onClick={handleMostrador}
            />
            <ActionCard
              label="Retiro"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              }
              onClick={handleRetiro}
            />
            <ActionCard
              label="Comandero"
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <path d="M9 14l2 2 4-4"/>
                </svg>
              }
              onClick={handleNewOrder}
            />
          </div>

          {/* ── Open accounts ────────────────────────── */}
          {accounts.length > 0 && (
            <section>
              <h2
                className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 px-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Cuentas abiertas ({accounts.length})
              </h2>
              <div className="space-y-2">
                {accounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => router.push(`/pos/comandero?cuenta=${account.id}`)}
                    className="w-full bg-white rounded-2xl p-4 border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all text-left active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                          account.status === 'abierta' ? 'bg-blue-100 text-blue-600' :
                          account.status === 'con_pedidos' ? 'bg-amber-100 text-amber-600' :
                          account.status === 'cuenta_pedida' ? 'bg-orange-100 text-orange-600' :
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                          {account.type === 'mesa'
                            ? account.table_number || 'M'
                            : account.type === 'mostrador'
                            ? 'MO'
                            : 'RE'
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">
                            {account.type === 'mesa'
                              ? `Mesa ${account.table_number}`
                              : account.type === 'mostrador'
                              ? 'Mostrador'
                              : `Retiro: ${account.customer_name}`
                            }
                          </p>
                          <p className="text-xs text-stone-400">
                            {account.items.filter(i => !i.voided).length} ítems
                            {' · '}
                            {account.rounds.length} ronda{account.rounds.length !== 1 ? 's' : ''}
                            {' · '}
                            {timeSince(account.opened_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                          ${account.total.toLocaleString('es-CL')}
                        </p>
                        {account.paid > 0 && (
                          <p className="text-xs text-emerald-600 tabular-nums">
                            Pagado: ${account.paid.toLocaleString('es-CL')}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Empty state ──────────────────────────── */}
          {accounts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-300">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
              </div>
              <p className="text-stone-400 text-sm">Sin cuentas abiertas</p>
              <p className="text-stone-300 text-xs mt-1">Toca Mostrador, Retiro o Comandero para empezar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Components ───────────────────────────────────────────────────

function ActionCard({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-5 bg-white rounded-2xl border border-stone-100 hover:border-amber-200 hover:bg-amber-50/30 active:scale-[0.97] transition-all"
    >
      <div className="text-amber-600">{icon}</div>
      <span className="text-sm font-medium text-stone-700" style={{ fontFamily: 'var(--font-display)' }}>
        {label}
      </span>
    </button>
  )
}

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}
