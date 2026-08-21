// Cliente del puente de impresión ESC/POS
// El POS llama al puente local (http://localhost:7777) para imprimir comandas

export interface BridgeConfig {
  url: string  // ej: "http://192.168.1.10:7777" o "http://localhost:7777"
}

export interface ComandaPayload {
  jobId: string
  type: 'mesa' | 'mostrador' | 'retiro'
  tableNumber?: string
  customerName?: string
  pickupTime?: string
  accountId: string
  roundNumber: number
  sentBy: string
  items: ComandaItem[]
}

export interface ComandaItem {
  quantity: number
  dish_name: string
  modifiers: { name: string; price_adjustment: number }[]
  note?: string
}

export interface BridgeStatus {
  ok: boolean
  bridge?: { version: string; port: number }
  printer?: { ok: boolean; mode: string; error?: string; availablePrinters?: string[] }
  queue?: { pending: number }
  error?: string
}

// ── Config persistida en localStorage ────────────────────────────

const LS_KEY = 'pos_bridge_url'

export function getBridgeUrl(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(LS_KEY) || 'http://localhost:7777'
}

export function setBridgeUrl(url: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, url.replace(/\/$/, ''))
}

// ── API calls ─────────────────────────────────────────────────────

export async function printComanda(comanda: ComandaPayload): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const url = getBridgeUrl()
  try {
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comanda),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, jobId: data.jobId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión con el puente' }
  }
}

export async function printTest(): Promise<{ ok: boolean; error?: string }> {
  const url = getBridgeUrl()
  try {
    const res = await fetch(`${url}/test`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Puente no responde' }
  }
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  const url = getBridgeUrl()
  try {
    const res = await fetch(`${url}/status`, {
      signal: AbortSignal.timeout(3000),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Puente no responde en ' + url }
  }
}

export async function cancelPrintJob(jobId: string): Promise<void> {
  const url = getBridgeUrl()
  try {
    await fetch(`${url}/queue/${jobId}`, { method: 'DELETE', signal: AbortSignal.timeout(3000) })
  } catch {}
}
