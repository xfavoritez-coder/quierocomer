// Cliente del puente de impresión ESC/POS
// El POS llama al agente local (http://localhost:7777) para imprimir comandas.
// El POS renderiza la comanda a bytes ESC/POS y se los manda crudos (base64);
// el agente solo los imprime. Mismo agente que el del ecommerce (unificado).
import { encodeComanda, encodeKitchenComanda, encodeTest, encodeCashClose, encodeBoleta, bytesToBase64 } from "./escpos";

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

// Comanda de cocina (letra grande, con datos del cliente, sin precios).
export interface KitchenComandaPayload {
  jobId: string
  type: 'mesa' | 'mostrador' | 'retiro' | 'delivery'
  orderLabel: string          // "#1A2B" (número de pedido)
  tableNumber?: string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  pickupTime?: string
  sentBy: string
  items: ComandaItem[]
}

// Boleta electrónica (representación impresa térmica, con timbre PDF417).
export interface BoletaLine { name: string; qty: number; price: number }
export interface BoletaPayload {
  jobId: string
  emisorName: string
  emisorRut: string
  emisorGiro?: string
  emisorAddress?: string
  folio: number
  fecha: string          // "12/11/2026 16:09"
  items: BoletaLine[]
  total: number
  siiOffice?: string     // "S.I.I. - Santiago Oriente"; default según entorno
  resolution?: string    // "Res. 80 de 2014" (datos del emisor, para el pie legal)
  tedRaster?: { width: number; height: number; data: number[] } // timbre PDF417 rasterizado (GS v 0)
  verifyUrl?: string     // consulta pública (public_url)
  sandbox?: boolean
}

export interface CashCloseMethod {
  label: string
  amount: number
  count: number
}

export interface CashClosePayload {
  jobId: string
  restaurantName?: string
  date: string        // "02/11/2026"
  openedAt: string    // "12:53"
  closedAt: string    // "12:54"
  closedAccounts: number
  methods: CashCloseMethod[]
  totalTips: number
  totalSales: number
  opening: number
  cashSales: number
  expectedCash: number
  countedCash: number | null  // null = efectivo no contado
  difference: number | null
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

// ── Comandas de cocina (letra grande) — preferencia por equipo ────
const LS_KITCHEN = 'pos_kitchen_comanda'

export function getKitchenMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_KITCHEN) === '1'
}

export function setKitchenMode(on: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KITCHEN, on ? '1' : '0')
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

export async function printKitchenComanda(payload: KitchenComandaPayload): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const url = getBridgeUrl()
  try {
    const escpos = bytesToBase64(encodeKitchenComanda(payload))
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: payload.jobId, escpos }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, jobId: data.jobId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión con el agente' }
  }
}

export async function printCashClose(payload: CashClosePayload): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const url = getBridgeUrl()
  try {
    const escpos = bytesToBase64(encodeCashClose(payload))
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: payload.jobId, escpos }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, jobId: data.jobId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión con el agente' }
  }
}

export async function printBoleta(payload: BoletaPayload): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const url = getBridgeUrl()
  try {
    const escpos = bytesToBase64(encodeBoleta(payload))
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: payload.jobId, escpos }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, jobId: data.jobId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de conexión con el agente' }
  }
}

/**
 * Trae los datos de la boleta de una venta (/api/pos/boleta-print) y la imprime
 * en la caja. Reintenta mientras la boleta se está emitiendo (emisión async al
 * cobrar). Para reimprimir desde el historial basta retries=1.
 */
// Convierte el PNG del timbre (base64) a un raster 1-bit para ESC/POS (GS v 0),
// escalado para caber en el papel (80mm = 576 puntos). Sin librerías: usa canvas.
async function pngToRaster(pngBase64: string, maxWidth = 576): Promise<{ width: number; height: number; data: number[] } | null> {
  if (typeof document === 'undefined') return null
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('img')); img.src = 'data:image/png;base64,' + pngBase64 })
    const w0 = img.naturalWidth, h0 = img.naturalHeight
    if (!w0 || !h0) return null
    const scale = w0 > maxWidth ? maxWidth / w0 : 1
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale))
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const px = ctx.getImageData(0, 0, w, h).data
    const bytesPerRow = Math.ceil(w / 8)
    const data: number[] = new Array(bytesPerRow * h).fill(0)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
        if (px[i + 3] > 128 && lum < 128) data[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x & 7))
      }
    }
    return { width: w, height: h, data }
  } catch { return null }
}

export async function printBoletaForOrder(posOrderId: string, opts?: { retries?: number; intervalMs?: number }): Promise<{ ok: boolean; printed?: boolean; error?: string; notReady?: boolean }> {
  const retries = opts?.retries ?? 1
  const interval = opts?.intervalMs ?? 2000
  for (let i = 0; i < retries; i++) {
    let data: any = {}
    try {
      const res = await fetch(`/api/pos/boleta-print?posOrderId=${encodeURIComponent(posOrderId)}`, { cache: 'no-store' })
      data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    } catch {
      return { ok: false, error: 'No se pudo consultar la boleta' }
    }
    // El local no emite boletas por SharkPOS → no es error, simplemente no hay boleta.
    if (data.enabled === false) return { ok: true, printed: false }
    // La emisión falló (p. ej. 4xx de SharkPOS) → no tiene sentido reintentar.
    if (data.failed) return { ok: false, error: 'La emisión de la boleta falló' }
    if (data.ready && data.boleta) {
      const b = data.boleta
      const tedRaster = b.tedPngBase64 ? await pngToRaster(b.tedPngBase64, 420) : undefined
      const pr = await printBoleta({
        jobId: 'bol_' + posOrderId, emisorName: b.emisorName, emisorRut: b.emisorRut,
        emisorGiro: b.emisorGiro, emisorAddress: b.emisorAddress,
        siiOffice: b.siiOffice, resolution: b.resolution,
        folio: b.folio, fecha: b.fecha, items: b.items, total: b.total,
        tedRaster: tedRaster || undefined, verifyUrl: b.verifyUrl, sandbox: b.sandbox,
      })
      return { ...pr, printed: pr.ok }
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, interval))
  }
  return { ok: false, notReady: true, error: 'La boleta aún se está emitiendo' }
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
