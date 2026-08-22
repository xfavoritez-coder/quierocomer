import { v4 as uuidv4 } from 'uuid'
import { posDb } from './db'
import { notifyDbChange } from './notify'
import type {
  PosEvent,
  PosEventType,
  AccountOpenedPayload,
  RoundSentPayload,
  ItemVoidedPayload,
  PaymentRecordedPayload,
  AccountClosedPayload,
  AccountVoidedPayload,
  CashSessionOpenedPayload,
  CashSessionClosedPayload,
  BillRequestedPayload,
} from './types'

// ── Device & user context ────────────────────────────────────────

let _deviceId: string | null = null
let _userId: string = 'system'
let _restaurantId: string = ''

export function setDeviceId(id: string) { _deviceId = id }
export function setUserId(id: string) { _userId = id }
export function setRestaurantId(id: string) { _restaurantId = id }

export function getDeviceId(): string {
  if (!_deviceId) {
    // Generar y persistir device_id en localStorage
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pos_device_id') : null
    if (stored) {
      _deviceId = stored
    } else {
      _deviceId = uuidv4()
      if (typeof window !== 'undefined') {
        localStorage.setItem('pos_device_id', _deviceId)
      }
    }
  }
  return _deviceId
}

// ── Create event ─────────────────────────────────────────────────

export async function createEvent(
  type: PosEventType,
  payload: Record<string, unknown>
): Promise<PosEvent> {
  const event: PosEvent = {
    event_id: uuidv4(),
    device_id: getDeviceId(),
    user_id: _userId,
    restaurant_id: _restaurantId,
    created_at_local: new Date().toISOString(),
    type,
    payload,
    synced: 0,
  }

  await posDb.transaction('rw', [posDb.events, posDb.syncQueue], async () => {
    await posDb.events.put(event)
    await posDb.syncQueue.add({
      event_id: event.event_id,
      created_at: event.created_at_local,
      retries: 0,
    })
  })

  // Project the event into materialized state
  await projectEvent(event)

  notifyDbChange()

  return event
}

// ── Convenience creators ─────────────────────────────────────────

export async function openAccount(payload: AccountOpenedPayload) {
  return createEvent('account_opened', payload as unknown as Record<string, unknown>)
}

export async function sendRound(payload: RoundSentPayload) {
  return createEvent('round_sent', payload as unknown as Record<string, unknown>)
}

export async function voidItem(payload: ItemVoidedPayload) {
  return createEvent('item_voided', payload as unknown as Record<string, unknown>)
}

export async function recordPayment(payload: PaymentRecordedPayload) {
  return createEvent('payment_recorded', payload as unknown as Record<string, unknown>)
}

export async function closeAccount(payload: AccountClosedPayload) {
  return createEvent('account_closed', payload as unknown as Record<string, unknown>)
}

export async function voidAccount(payload: AccountVoidedPayload) {
  return createEvent('account_voided', payload as unknown as Record<string, unknown>)
}

export async function requestBill(payload: BillRequestedPayload) {
  return createEvent('bill_requested', payload as unknown as Record<string, unknown>)
}

export async function openCashSession(payload: CashSessionOpenedPayload) {
  return createEvent('cash_session_opened', payload as unknown as Record<string, unknown>)
}

export async function closeCashSession(payload: CashSessionClosedPayload) {
  return createEvent('cash_session_closed', payload as unknown as Record<string, unknown>)
}

// ── Projection engine (incremental) ─────────────────────────────

export async function projectEvent(event: PosEvent): Promise<void> {
  const p = event.payload

  switch (event.type) {
    case 'account_opened': {
      const d = p as unknown as AccountOpenedPayload
      await posDb.accounts.put({
        id: d.account_id,
        type: d.account_type,
        status: 'abierta',
        table_id: d.table_id,
        table_number: d.table_number,
        customer_name: d.customer_name,
        pickup_time: d.pickup_time,
        customer_phone: d.customer_phone,
        delivery_address: d.delivery_address,
        opened_at: event.created_at_local,
        opened_by: event.user_id,
        total: 0,
        paid: 0,
        items: [],
        rounds: [],
        payments: [],
      })
      break
    }

    case 'round_sent': {
      const d = p as unknown as RoundSentPayload
      const account = await posDb.accounts.get(d.account_id)
      if (!account) break

      const newItems = d.items.map(item => ({
        id: item.item_id,
        dish_id: item.dish_id,
        dish_name: item.dish_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        modifiers: item.modifiers,
        note: item.note,
        round_id: d.round_id,
        voided: false,
        paid: false,
      }))

      const round = {
        id: d.round_id,
        account_id: d.account_id,
        sent_at: event.created_at_local,
        sent_by: event.user_id,
        items: newItems,
      }

      const allItems = [...account.items, ...newItems]
      const total = calcTotal(allItems)

      await posDb.accounts.update(d.account_id, {
        items: allItems,
        rounds: [...account.rounds, round],
        total,
        status: 'con_pedidos',
      })
      break
    }

    case 'item_voided': {
      const d = p as unknown as ItemVoidedPayload
      const account = await posDb.accounts.get(d.account_id)
      if (!account) break

      const items = account.items.map(item =>
        item.id === d.item_id
          ? { ...item, voided: true, voided_reason: d.reason }
          : item
      )
      const total = calcTotal(items)

      await posDb.accounts.update(d.account_id, { items, total })
      break
    }

    case 'payment_recorded': {
      const d = p as unknown as PaymentRecordedPayload
      const account = await posDb.accounts.get(d.account_id)
      if (!account) break

      const payment = {
        id: d.payment_id,
        account_id: d.account_id,
        amount: d.amount,
        tip: d.tip,
        method: d.method,
        item_ids: d.item_ids,
        split_index: d.split_index,
        recorded_at: event.created_at_local,
        recorded_by: event.user_id,
      }

      // Marcar ítems como pagados si es división por ítems
      let items = account.items
      if (d.item_ids?.length) {
        items = items.map(item =>
          d.item_ids!.includes(item.id) ? { ...item, paid: true } : item
        )
      }

      const paid = account.paid + d.amount + d.tip
      const status = paid >= account.total ? 'pagada_parcial' : 'pagada_parcial'

      await posDb.accounts.update(d.account_id, {
        items,
        payments: [...account.payments, payment],
        paid,
        status,
      })
      break
    }

    case 'account_closed': {
      const d = p as unknown as AccountClosedPayload
      await posDb.accounts.update(d.account_id, {
        status: 'cerrada',
        closed_at: event.created_at_local,
      })
      break
    }

    case 'account_voided': {
      const d = p as unknown as AccountVoidedPayload
      await posDb.accounts.update(d.account_id, {
        status: 'anulada',
        closed_at: event.created_at_local,
      })
      break
    }

    case 'cash_session_opened': {
      const d = p as unknown as CashSessionOpenedPayload
      await posDb.cashSessions.put({
        id: d.session_id,
        opened_at: event.created_at_local,
        opened_by: event.user_id,
        initial_amount: d.initial_amount,
        is_open: true,
      })
      break
    }

    case 'cash_session_closed': {
      const d = p as unknown as CashSessionClosedPayload
      await posDb.cashSessions.update(d.session_id, {
        closed_at: event.created_at_local,
        closed_by: event.user_id,
        counted_amounts: d.counted_amounts,
        expected_amounts: d.expected_amounts,
        difference: d.difference,
        note: d.note,
        is_open: false,
      })
      break
    }

    case 'bill_requested': {
      const d = p as unknown as BillRequestedPayload
      await posDb.accounts.update(d.account_id, { status: 'cuenta_pedida' })
      break
    }
  }
}

// ── Full rebuild from events (recovery / initial load) ───────────

export async function rebuildFromEvents(restaurantId: string): Promise<void> {
  // Limpiar proyecciones
  await posDb.accounts.clear()

  // Obtener todos los eventos ordenados
  const events = await posDb.events
    .where('restaurant_id')
    .equals(restaurantId)
    .sortBy('created_at_local')

  for (const event of events) {
    await projectEvent(event)
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function calcTotal(items: { quantity: number; unit_price: number; modifiers: { price_adjustment: number }[]; voided: boolean }[]): number {
  return items
    .filter(i => !i.voided)
    .reduce((sum, item) => {
      const modExtra = item.modifiers.reduce((m, mod) => m + mod.price_adjustment, 0)
      return sum + item.quantity * (item.unit_price + modExtra)
    }, 0)
}
