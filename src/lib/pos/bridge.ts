// Cliente del puente de impresión ESC/POS
// El POS llama al agente local (http://localhost:7777) para imprimir comandas.
// El POS renderiza la comanda a bytes ESC/POS y se los manda crudos (base64);
// el agente solo los imprime. Mismo agente que el del ecommerce (unificado).
import { encodeComanda, encodeTest, bytesToBase64 } from "./escpos";

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
    const escpos = bytesToBase64(encodeComanda(comanda))
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: comanda.jobId, escpos }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, jobId: data.jobId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión con el agente' }
  }
}

export async function printTest(): Promise<{ ok: boolean; error?: string }> {
  const url = getBridgeUrl()
  try {
    const escpos = bytesToBase64(encodeTest())
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'test', escpos }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Agente no responde' }
  }
}

// Lista las impresoras instaladas en el equipo del agente (para elegir en la UI).
export async function listPrinters(): Promise<{ ok: boolean; printers?: string[]; error?: string }> {
  const url = getBridgeUrl()
  try {
    const res = await fetch(`${url}/printers`, { signal: AbortSignal.timeout(3000) })
    return await res.json()
  } catch {
    return { ok: false, error: 'Agente no responde' }
  }
}

// Guarda en el agente la impresora local a usar (persistente en ese equipo).
export async function setupPrinter(cfg: { target: 'default' | 'name' | 'ip'; name?: string; ip?: string }): Promise<{ ok: boolean; error?: string }> {
  const url = getBridgeUrl()
  try {
    const res = await fetch(`${url}/setup/printer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
      signal: AbortSignal.timeout(3000),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Agente no responde' }
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
