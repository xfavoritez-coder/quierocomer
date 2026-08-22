// POS QuieroComer — barrel export

export { posDb } from './db'
export type { DailySnapshot, SyncQueueEntry } from './db'

export * from './types'

export {
  setDeviceId,
  setUserId,
  setRestaurantId,
  getDeviceId,
  createEvent,
  openAccount,
  sendRound,
  voidItem,
  recordPayment,
  closeAccount,
  voidAccount,
  openCashSession,
  closeCashSession,
  requestBill,
  projectEvent,
  rebuildFromEvents,
} from './events'

export { startSync, stopSync, forceSyncNow } from './sync'
export { refreshCatalog, getCachedCategories, getCachedProducts } from './catalog'

export { notifyDbChange } from './notify'
export {
  useOnlineStatus,
  usePosSync,
  usePendingSyncCount,
  useOpenAccounts,
  useAccount,
  useOpenCashSession,
  useSessionSummary,
  useRecentEvents,
  useCatalog,
  useCategoryProducts,
  useTables,
} from './hooks'
export { saveTables } from './tables'
