'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import {
  useOnlineStatus,
  usePosSync,
  usePendingSyncCount,
  useOpenAccounts,
  useRecentEvents,
  setRestaurantId,
  setUserId,
  openAccount,
  sendRound,
  voidItem,
  recordPayment,
  closeAccount,
  openCashSession,
  closeCashSession,
  posDb,
} from '@/lib/pos'

// ── Hardcoded for testing — will come from auth later ────────────
const TEST_RESTAURANT_ID = 'test-restaurant'
const TEST_USER_ID = 'test-garzon'

export default function PosHomePage() {
  const online = useOnlineStatus()
  const { syncing } = usePosSync(TEST_RESTAURANT_ID)
  const pendingCount = usePendingSyncCount()
  const accounts = useOpenAccounts()
  const recentEvents = useRecentEvents(30)

  // Init context
  useState(() => {
    setRestaurantId(TEST_RESTAURANT_ID)
    setUserId(TEST_USER_ID)
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          POS QuieroComer
        </h1>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {syncing && (
            <span className="text-stone-400 text-xs">sincronizando...</span>
          )}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                online ? 'bg-emerald-500' : 'bg-red-400'
              }`}
            />
            <span className="text-xs">{online ? 'En línea' : 'Sin conexión'}</span>
          </div>
        </div>
      </div>

      {/* ── Test Actions ────────────────────────────── */}
      <section className="mb-8">
        <h2
          className="text-lg font-semibold mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Pruebas de Event Sourcing
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <TestButton
            label="Abrir mesa"
            onClick={async () => {
              const id = uuidv4()
              await openAccount({
                account_id: id,
                account_type: 'mesa',
                table_id: 'mesa-1',
                table_number: 1,
              })
              toast.success(`Mesa abierta: ${id.slice(0, 8)}`)
            }}
          />
          <TestButton
            label="Abrir mostrador"
            onClick={async () => {
              const id = uuidv4()
              await openAccount({
                account_id: id,
                account_type: 'mostrador',
              })
              toast.success(`Mostrador abierto: ${id.slice(0, 8)}`)
            }}
          />
          <TestButton
            label="Enviar ronda"
            disabled={accounts.length === 0}
            onClick={async () => {
              const account = accounts[0]
              if (!account) return
              await sendRound({
                round_id: uuidv4(),
                account_id: account.id,
                items: [
                  {
                    item_id: uuidv4(),
                    dish_id: 'test-dish-1',
                    dish_name: 'Hamburguesa Clásica',
                    quantity: 2,
                    unit_price: 8990,
                    modifiers: [
                      {
                        modifier_id: 'mod-1',
                        group_name: 'Extras',
                        option_name: 'Queso extra',
                        price_adjustment: 1500,
                      },
                    ],
                    note: 'Sin cebolla',
                  },
                  {
                    item_id: uuidv4(),
                    dish_id: 'test-dish-2',
                    dish_name: 'Papas Fritas',
                    quantity: 1,
                    unit_price: 3990,
                    modifiers: [],
                  },
                ],
              })
              toast.success('Ronda enviada')
            }}
          />
          <TestButton
            label="Anular ítem"
            disabled={!accounts.some(a => a.items.length > 0)}
            onClick={async () => {
              const account = accounts.find(a => a.items.some(i => !i.voided))
              if (!account) return
              const item = account.items.find(i => !i.voided)
              if (!item) return
              await voidItem({
                account_id: account.id,
                item_id: item.id,
                reason: 'Prueba de anulación',
              })
              toast.success(`Ítem anulado: ${item.dish_name}`)
            }}
          />
          <TestButton
            label="Registrar pago"
            disabled={!accounts.some(a => a.total > a.paid)}
            onClick={async () => {
              const account = accounts.find(a => a.total > a.paid && a.status !== 'cerrada')
              if (!account) return
              const remaining = account.total - account.paid
              await recordPayment({
                payment_id: uuidv4(),
                account_id: account.id,
                amount: remaining,
                tip: Math.round(remaining * 0.1 / 10) * 10, // 10% redondeado a $10
                method: 'efectivo',
              })
              toast.success(`Pago registrado: $${remaining.toLocaleString('es-CL')}`)
            }}
          />
          <TestButton
            label="Cerrar cuenta"
            disabled={!accounts.some(a => a.status !== 'cerrada' && a.status !== 'anulada')}
            onClick={async () => {
              const account = accounts.find(a => a.status !== 'cerrada' && a.status !== 'anulada')
              if (!account) return
              await closeAccount({ account_id: account.id })
              toast.success('Cuenta cerrada')
            }}
          />
          <TestButton
            label="Abrir caja"
            onClick={async () => {
              await openCashSession({
                session_id: uuidv4(),
                initial_amount: 50000,
              })
              toast.success('Caja abierta con $50.000')
            }}
          />
          <TestButton
            label="Cerrar caja"
            onClick={async () => {
              const session = await posDb.cashSessions.filter(s => s.is_open).first()
              if (!session) {
                toast.error('No hay caja abierta')
                return
              }
              await closeCashSession({
                session_id: session.id,
                counted_amounts: { efectivo: 100000, debito: 0, credito: 0, transferencia: 0, app_pago: 0 },
                expected_amounts: { efectivo: 95000, debito: 0, credito: 0, transferencia: 0, app_pago: 0 },
                difference: 5000,
                note: 'Sobran $5.000 de prueba',
              })
              toast.success('Caja cerrada')
            }}
          />
          <TestButton
            label="Limpiar todo"
            variant="danger"
            onClick={async () => {
              await posDb.events.clear()
              await posDb.accounts.clear()
              await posDb.cashSessions.clear()
              await posDb.syncQueue.clear()
              await posDb.rounds.clear()
              await posDb.payments.clear()
              toast.success('IndexedDB limpiada')
            }}
          />
        </div>
      </section>

      {/* ── Open Accounts ───────────────────────────── */}
      <section className="mb-8">
        <h2
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Cuentas abiertas ({accounts.length})
        </h2>
        {accounts.length === 0 ? (
          <p className="text-stone-400 text-sm">No hay cuentas abiertas</p>
        ) : (
          <div className="space-y-3">
            {accounts.map(account => (
              <div
                key={account.id}
                className="border border-stone-200 rounded-xl p-4 bg-stone-50/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      {account.type === 'mesa'
                        ? `Mesa ${account.table_number}`
                        : account.type === 'mostrador'
                        ? 'Mostrador'
                        : `Retiro: ${account.customer_name}`}
                    </span>
                    <StatusBadge status={account.status} />
                  </div>
                  <span className="font-bold text-lg tabular-nums">
                    ${account.total.toLocaleString('es-CL')}
                  </span>
                </div>
                {account.items.length > 0 && (
                  <div className="text-sm text-stone-600 space-y-1">
                    {account.items.map(item => (
                      <div
                        key={item.id}
                        className={`flex justify-between ${item.voided ? 'line-through text-stone-400' : ''}`}
                      >
                        <span>
                          {item.quantity}x {item.dish_name}
                          {item.modifiers.length > 0 && (
                            <span className="text-stone-400 ml-1">
                              ({item.modifiers.map(m => m.option_name).join(', ')})
                            </span>
                          )}
                          {item.note && (
                            <span className="text-amber-600 ml-1">📝 {item.note}</span>
                          )}
                        </span>
                        <span className="tabular-nums">
                          ${(item.quantity * (item.unit_price + item.modifiers.reduce((s, m) => s + m.price_adjustment, 0))).toLocaleString('es-CL')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {account.paid > 0 && (
                  <div className="mt-2 pt-2 border-t border-stone-200 text-sm flex justify-between">
                    <span className="text-stone-500">Pagado</span>
                    <span className="font-medium text-emerald-600 tabular-nums">
                      ${account.paid.toLocaleString('es-CL')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Event Log ───────────────────────────────── */}
      <section>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Log de eventos ({recentEvents.length})
        </h2>
        {recentEvents.length === 0 ? (
          <p className="text-stone-400 text-sm">Sin eventos</p>
        ) : (
          <div className="space-y-1.5 text-xs font-mono">
            {recentEvents.map(e => (
              <div
                key={e.event_id}
                className="flex items-start gap-2 py-1.5 px-3 rounded-lg bg-stone-50 border border-stone-100"
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${
                    e.synced ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <div className="min-w-0">
                  <span className="font-semibold text-stone-700">{e.type}</span>
                  <span className="text-stone-400 ml-2">
                    {new Date(e.created_at_local).toLocaleTimeString('es-CL')}
                  </span>
                  <span className="text-stone-300 ml-2">{e.event_id.slice(0, 8)}</span>
                  {e.server_seq && (
                    <span className="text-emerald-500 ml-2">seq:{e.server_seq}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Components ───────────────────────────────────────────────────

function TestButton({
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  label: string
  onClick: () => Promise<void>
  disabled?: boolean
  variant?: 'default' | 'danger'
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await onClick()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  const base = 'px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100'
  const variants = {
    default: 'bg-stone-100 hover:bg-stone-200 text-stone-700',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600',
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]}`}
    >
      {loading ? '...' : label}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    abierta: 'bg-blue-100 text-blue-700',
    con_pedidos: 'bg-amber-100 text-amber-700',
    cuenta_pedida: 'bg-orange-100 text-orange-700',
    pagada_parcial: 'bg-emerald-100 text-emerald-700',
    cerrada: 'bg-stone-100 text-stone-500',
    anulada: 'bg-red-100 text-red-600',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-stone-100 text-stone-500'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
