'use client'

// Config del POS (mesas / sectores / garzones) SERVER-AUTHORITATIVE (/api/pos/config).
// El servidor es la fuente de verdad (tablas Prisma PosTable/PosSector/PosStaff);
// aquí mantenemos una caché en memoria por local + suscripción para que los hooks
// (useTables/useSectors/useStaff) re-rendericen. Reemplaza el event-sourcing Dexie
// (pos_events), que un wipe borraba. Las escrituras POSTean y refrescan la caché.

import { posDb } from './db'
import type { PosTable, PosSector, PosStaff } from './types'

interface ConfigCache { tables: PosTable[]; sectors: PosSector[]; staff: PosStaff[]; loaded: boolean }
const EMPTY: ConfigCache = { tables: [], sectors: [], staff: [], loaded: false }

const cache = new Map<string, ConfigCache>()
const subs = new Set<() => void>()
const inflight = new Map<string, Promise<void>>()

function notify() { subs.forEach((f) => { try { f() } catch { /* noop */ } }) }

/** Lectura síncrona de la caché (lo que consumen los hooks en el render). */
export function getPosConfigSnapshot(restaurantId: string): ConfigCache {
  return cache.get(restaurantId) ?? EMPTY
}

/** Suscripción a cambios de la caché. Devuelve la función para desuscribir. */
export function subscribePosConfig(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}

/** Carga la config del servidor a la caché. Sin force: una sola vez por local
 *  (y deduplica llamadas concurrentes). Con force: siempre refresca. */
export async function loadPosConfig(restaurantId: string, opts?: { force?: boolean }): Promise<void> {
  if (!restaurantId) return
  // Deduplica llamadas concurrentes (incluido force): si ya hay un fetch en
  // curso, todos esperan el mismo (evita N fetches de los N hooks montados).
  const f = inflight.get(restaurantId); if (f) return f
  if (!opts?.force && cache.get(restaurantId)?.loaded) return
  const p = (async () => {
    try {
      const r = await fetch(`/api/pos/config?restaurantId=${restaurantId}`, { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      cache.set(restaurantId, { tables: j.tables ?? [], sectors: j.sectors ?? [], staff: j.staff ?? [], loaded: true })
      notify()
    } catch { /* red caída: mantener la caché */ }
    finally { inflight.delete(restaurantId) }
  })()
  inflight.set(restaurantId, p)
  return p
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch('/api/pos/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string })?.error || 'Error de configuración')
  return j as Record<string, unknown>
}

function patch(restaurantId: string, part: Partial<ConfigCache>) {
  const c = cache.get(restaurantId) ?? { ...EMPTY }
  cache.set(restaurantId, { ...c, ...part, loaded: true })
  notify()
}

/** Reemplaza el set completo de mesas (el cliente calcula el set y lo manda). */
export async function setTablesRemote(restaurantId: string, tables: PosTable[]): Promise<void> {
  const j = await post({ restaurantId, action: 'tables.set', tables })
  patch(restaurantId, { tables: (j.tables as PosTable[]) ?? [] })
}

/** Reemplaza el set completo de sectores. */
export async function setSectorsRemote(restaurantId: string, sectors: PosSector[]): Promise<void> {
  const j = await post({ restaurantId, action: 'sectors.set', sectors })
  patch(restaurantId, { sectors: (j.sectors as PosSector[]) ?? [] })
}

/** Reemplaza el set completo de garzones (solo para el backfill inicial). */
export async function setStaffRemote(restaurantId: string, staff: PosStaff[]): Promise<void> {
  const j = await post({ restaurantId, action: 'staff.set', staff })
  patch(restaurantId, { staff: (j.staff as PosStaff[]) ?? [] })
}

/** Alta/upsert de un garzón. */
export async function addStaffRemote(restaurantId: string, staff: { id?: string; name: string; role?: string; pin_hash?: string; active?: boolean }): Promise<void> {
  await post({ restaurantId, action: 'staff.add', staff })
  await loadPosConfig(restaurantId, { force: true })
}

/** Baja de un garzón. */
export async function deleteStaffRemote(restaurantId: string, staffId: string): Promise<void> {
  await post({ restaurantId, action: 'staff.delete', staffId })
  await loadPosConfig(restaurantId, { force: true })
}

// ── Backfill one-time: Dexie/pos_events → servidor ──────────────────
// Corre al montar el POS. Si el servidor YA tiene config de este local, no hace
// nada (ya migrado). Si está vacío pero el dispositivo tiene la config vieja en
// Dexie, la sube CONSERVANDO los ids (para no romper el vínculo mesa→sector).
// Idempotente: una vez que el servidor tiene datos, se omite en todos los equipos.
export async function backfillPosConfig(restaurantId: string): Promise<void> {
  if (!restaurantId) return
  try {
    await loadPosConfig(restaurantId, { force: true })
    const snap = getPosConfigSnapshot(restaurantId)
    if (snap.tables.length || snap.sectors.length || snap.staff.length) return // ya migrado

    const [tables, sectors, staff] = await Promise.all([
      posDb.posTables.where('restaurant_id').equals(restaurantId).toArray(),
      posDb.posSectors.where('restaurant_id').equals(restaurantId).toArray(),
      posDb.staff.where('restaurant_id').equals(restaurantId).toArray(),
    ])
    if (!tables.length && !sectors.length && !staff.length) return // nada que migrar

    // Sectores primero (las mesas referencian sectorId), luego mesas, luego staff.
    if (sectors.length) await setSectorsRemote(restaurantId, sectors)
    if (tables.length) await setTablesRemote(restaurantId, tables)
    // Dedup de garzones por nombre (el Dexie podía tener duplicados históricos).
    if (staff.length) {
      const seen = new Set<string>()
      const unique = staff.filter((s) => {
        const k = s.name.trim().toLowerCase()
        if (!k || seen.has(k)) return false
        seen.add(k); return true
      })
      if (unique.length) await setStaffRemote(restaurantId, unique)
    }
  } catch { /* si falla, la config vieja sigue en Dexie; se reintenta al próximo montaje */ }
}
