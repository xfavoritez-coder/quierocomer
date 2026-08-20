import Dexie, { type EntityTable } from 'dexie'
import type {
  PosEvent,
  Account,
  AccountItem,
  Round,
  Payment,
  CashSession,
  PosTable,
  PosStaff,
  PosDevice,
  CachedProduct,
} from './types'

// ── Snapshot (materialización diaria) ────────────────────────────

export interface DailySnapshot {
  id: string                    // restaurant_id + date
  restaurant_id: string
  date: string                  // YYYY-MM-DD
  last_event_seq: number
  accounts: Account[]
  cash_session: CashSession | null
  created_at: string
}

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
  items!: EntityTable<AccountItem, 'id'>
  rounds!: EntityTable<Round, 'id'>
  payments!: EntityTable<Payment, 'id'>
  cashSessions!: EntityTable<CashSession, 'id'>
  posTables!: EntityTable<PosTable, 'id'>
  staff!: EntityTable<PosStaff, 'id'>
  devices!: EntityTable<PosDevice, 'id'>
  products!: EntityTable<CachedProduct, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>
  snapshots!: EntityTable<DailySnapshot, 'id'>

  constructor() {
    super('pos_quierocomer')

    this.version(1).stores({
      // Events: indexed by restaurant + sync status for push, server_seq for pull
      events: 'event_id, [restaurant_id+synced], [restaurant_id+type], server_seq, created_at_local',

      // Projected state (materialized views)
      accounts: 'id, [table_id+status], status, type',
      items: 'id, [account_id+voided], round_id',
      rounds: 'id, account_id',
      payments: 'id, account_id',
      cashSessions: 'id, is_open',

      // Config
      posTables: 'id, restaurant_id, number',
      staff: 'id, restaurant_id, [restaurant_id+active]',
      devices: 'id, restaurant_id',

      // Catalog cache
      products: 'id, [restaurant_id+is_active], category_id',

      // Sync
      syncQueue: '++id, event_id',

      // Snapshots
      snapshots: 'id, [restaurant_id+date]',
    })
  }
}

// Singleton
export const posDb = new PosDatabase()
