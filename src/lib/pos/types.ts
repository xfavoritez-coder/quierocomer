// ── POS Domain Types ──────────────────────────────────────────────

export type AccountType = 'mesa' | 'mostrador' | 'retiro'
export type AccountStatus = 'abierta' | 'con_pedidos' | 'cuenta_pedida' | 'pagada_parcial' | 'cerrada' | 'anulada'
export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'app_pago'
export type StaffRole = 'admin' | 'garzon'

// ── Events ───────────────────────────────────────────────────────

export type PosEventType =
  | 'account_opened'
  | 'round_sent'
  | 'item_voided'
  | 'item_updated'
  | 'payment_recorded'
  | 'account_closed'
  | 'account_voided'
  | 'cash_session_opened'
  | 'cash_session_closed'

export interface PosEvent {
  event_id: string        // UUID v4 generado en cliente
  device_id: string
  user_id: string         // pos_staff id o 'system'
  restaurant_id: string
  created_at_local: string // ISO string
  type: PosEventType
  payload: Record<string, unknown>
  // Sync fields
  synced: 0 | 1           // 0 = pendiente, 1 = sincronizado
  server_seq?: number     // Secuencia del servidor (asignada al sincronizar)
}

// ── Event Payloads ───────────────────────────────────────────────

export interface AccountOpenedPayload {
  account_id: string
  account_type: AccountType
  table_id?: string
  table_number?: number
  customer_name?: string  // retiro
  pickup_time?: string    // retiro
}

export interface RoundSentPayload {
  round_id: string
  account_id: string
  items: RoundItem[]
}

export interface RoundItem {
  item_id: string
  dish_id: string
  dish_name: string
  quantity: number
  unit_price: number
  modifiers: ItemModifier[]
  note?: string
}

export interface ItemModifier {
  modifier_id: string
  group_name: string
  option_name: string
  price_adjustment: number
}

export interface ItemVoidedPayload {
  account_id: string
  item_id: string
  reason: string
}

export interface ItemUpdatedPayload {
  account_id: string
  item_id: string
  quantity?: number
  modifiers?: ItemModifier[]
  note?: string
}

export interface PaymentRecordedPayload {
  payment_id: string
  account_id: string
  amount: number
  tip: number
  method: PaymentMethod
  item_ids?: string[]     // división por ítems
  split_index?: number    // división en partes
}

export interface AccountClosedPayload {
  account_id: string
}

export interface AccountVoidedPayload {
  account_id: string
  reason: string
}

export interface CashSessionOpenedPayload {
  session_id: string
  initial_amount: number
}

export interface CashSessionClosedPayload {
  session_id: string
  counted_amounts: Record<PaymentMethod, number>
  expected_amounts: Record<PaymentMethod, number>
  difference: number
  note?: string
}

// ── Projected State (materialized from events) ──────────────────

export interface Account {
  id: string
  type: AccountType
  status: AccountStatus
  table_id?: string
  table_number?: number
  customer_name?: string
  pickup_time?: string
  opened_at: string
  opened_by: string
  closed_at?: string
  total: number
  paid: number
  items: AccountItem[]
  rounds: Round[]
  payments: Payment[]
}

export interface AccountItem {
  id: string
  dish_id: string
  dish_name: string
  quantity: number
  unit_price: number
  modifiers: ItemModifier[]
  note?: string
  round_id: string
  voided: boolean
  voided_reason?: string
  paid: boolean
}

export interface Round {
  id: string
  account_id: string
  sent_at: string
  sent_by: string
  items: AccountItem[]
}

export interface Payment {
  id: string
  account_id: string
  amount: number
  tip: number
  method: PaymentMethod
  item_ids?: string[]
  split_index?: number
  recorded_at: string
  recorded_by: string
}

export interface CashSession {
  id: string
  opened_at: string
  opened_by: string
  initial_amount: number
  closed_at?: string
  closed_by?: string
  counted_amounts?: Record<PaymentMethod, number>
  expected_amounts?: Record<PaymentMethod, number>
  difference?: number
  note?: string
  is_open: boolean
}

// ── Table (mapa de mesas) ────────────────────────────────────────

export interface PosTable {
  id: string
  restaurant_id: string
  number: number
  label?: string
  x: number
  y: number
  active: boolean
}

// ── Staff ────────────────────────────────────────────────────────

export interface PosStaff {
  id: string
  restaurant_id: string
  name: string
  pin_hash: string
  role: StaffRole
  active: boolean
}

// ── Device ───────────────────────────────────────────────────────

export interface PosDevice {
  id: string
  restaurant_id: string
  name: string
  is_shared: boolean
  registered_at: string
}

// ── Cached product (from Carta QR) ──────────────────────────────

export interface CachedProduct {
  id: string
  restaurant_id: string
  category_id: string
  category_name: string
  category_position: number
  name: string
  description?: string
  price: number
  discount_price?: number
  photos: string[]
  is_active: boolean
  position: number
  modifier_templates: CachedModifierTemplate[]
}

export interface CachedModifierTemplate {
  id: string
  name: string
  groups: CachedModifierGroup[]
}

export interface CachedModifierGroup {
  id: string
  name: string
  required: boolean
  min_select: number
  max_select: number
  options: CachedModifierOption[]
}

export interface CachedModifierOption {
  id: string
  name: string
  price_adjustment: number
  is_default: boolean
}
