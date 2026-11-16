import Dexie, { type EntityTable } from 'dexie'
import type {
  PosEvent,
  Account,
  CashSession,
  Shift,
  PosTable,
  PosSector,
  PosStaff,
  CachedProduct,
} from './types'

// ── Sync queue entry ─────────────────────────────────────────────

export interface SyncQueueEntry {
  id?: number                   // auto-increment
  event_id: string
  created_at: string
  retries: number
}

// ── Database ─────────────────────────────────────────────────────

export class PosDatabase extends Dexie {
  events!: EntityTable<PosEvent, 'event_id'>
  accounts!: EntityTable<Account, 'id'>
  cashSessions!: EntityTable<CashSession, 'id'>
  shifts!: EntityTable<Shift, 'id'>
  posTables!: EntityTable<PosTable, 'id'>
  posSectors!: EntityTable<PosSector, 'id'>
  staff!: EntityTable<PosStaff, 'id'>
  products!: EntityTable<CachedProduct, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>

  constructor() {
    super('pos_quierocomer')

    this.version(1).stores({
      events: 'event_id, [restaurant_id+synced], [restaurant_id+type], server_seq, created_at_local',
      accounts: 'id, [table_id+status], status, type',
      items: 'id, [account_id+voided], round_id',
      rounds: 'id, account_id',
      payments: 'id, account_id',
      cashSessions: 'id, is_open',
      posTables: 'id, restaurant_id, number',
      staff: 'id, restaurant_id, [restaurant_id+active]',
      devices: 'id, restaurant_id',
      products: 'id, [restaurant_id+is_active], category_id',
      syncQueue: '++id, event_id',
      snapshots: 'id, [restaurant_id+date]',
    })

    this.version(2).stores({
      posTables: 'id, restaurant_id, number, sector_id',
      posSectors: 'id, restaurant_id',
    })

    // Turno (capa externa sobre las cajas).
    this.version(3).stores({
      shifts: 'id, is_open, [restaurant_id+is_open]',
    })

    // Limpieza: stores declarados en v1 pero NUNCA usados (ningún `posDb.items/
    // rounds/payments/devices/snapshots` en el código). Los ítems/rondas/pagos
    // viven embebidos en `accounts`; el device_id en localStorage. Se dropean
    // (están vacíos). Dexie los crea en v1 y los elimina aquí → neto: no existen.
    this.version(4).stores({
      items: null,
      rounds: null,
      payments: null,
      devices: null,
      snapshots: null,
    })
  }
}

// Singleton
export const posDb = new PosDatabase()
