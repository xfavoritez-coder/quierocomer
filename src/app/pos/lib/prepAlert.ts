// Helpers de la alerta "retiro atascado en preparación".
export const PREP_DEFAULT_MIN = 60
export const PREP_SNOOZE_MS = 60 * 60 * 1000 // "Posponer 1 hora más"
const PREP_SNOOZE_KEY = 'pos:prepAlertSnooze'

export interface PrepAlertOrder {
  id: string
  createdAt: string
  opsStage: string
  saleType?: string
  isDelivery?: boolean
  customerName?: string | null
  customerPhone?: string | null
  orderReference?: string | null
  dailyNumber?: number | null
  opsReadyForDeliveryAt?: string | null
}

// ¿Es un pedido de retiro? (ni delivery ni salón).
export function isRetiroOrder(o: PrepAlertOrder): boolean {
  const isDelivery = !!o.isDelivery || o.saleType === 'delivery'
  const isDineIn = !isDelivery && (o.saleType === 'dine-in' || o.saleType === 'dinein')
  return !isDelivery && !isDineIn
}

export function prepSnoozedUntil(id: string): number {
  try {
    const m = JSON.parse(localStorage.getItem(PREP_SNOOZE_KEY) || '{}')
    return typeof m[id] === 'number' ? m[id] : 0
  } catch { return 0 }
}

export function prepSnooze(id: string, ms: number) {
  try {
    const m = JSON.parse(localStorage.getItem(PREP_SNOOZE_KEY) || '{}')
    const now = Date.now()
    m[id] = now + ms
    for (const k of Object.keys(m)) if (typeof m[k] !== 'number' || m[k] < now) delete m[k]
    localStorage.setItem(PREP_SNOOZE_KEY, JSON.stringify(m))
  } catch { }
}

// "1 h 05 min" / "65 min"
export function fmtElapsedMin(ms: number): string {
  const min = Math.floor(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}
