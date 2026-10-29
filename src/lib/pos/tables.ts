import { v4 as uuidv4 } from 'uuid'
import { posDb } from './db'
import { configureTables, configureSectors } from './events'
import type { PosTable, PosSector } from './types'

// ── One-time migration: emit events for tables/sectors created before sync ──

export async function migrateLocalTablesToEvents(restaurantId: string): Promise<void> {
  const hasEvent = await posDb.events
    .where('restaurant_id').equals(restaurantId)
    .filter(e => e.type === 'tables_configured' || e.type === 'sectors_configured')
    .first()
  if (hasEvent) return

  const tables = await posDb.posTables.where('restaurant_id').equals(restaurantId).toArray()
  const sectors = await posDb.posSectors.where('restaurant_id').equals(restaurantId).toArray()

  if (sectors.length > 0) await configureSectors({ sectors })
  if (tables.length > 0) await configureTables({ tables })
}

export async function saveTables(restaurantId: string, tables: { number: number; label?: string; sector_id?: string }[]): Promise<void> {
  const rows: PosTable[] = tables.map((t, i) => ({
    id: uuidv4(),
    restaurant_id: restaurantId,
    number: t.number,
    label: t.label,
    sector_id: t.sector_id,
    x: (i % 5) * 1,
    y: Math.floor(i / 5),
    active: true,
  }))
  await configureTables({ tables: rows })
}

const idOf = (t: { label?: string; number: number }) => t.label || String(t.number)

/** Siguiente número correlativo para un prefijo, mirando las mesas ya existentes. */
export function nextTableNumber(tables: { label?: string; number: number }[], prefix: string): number {
  const p = prefix.trim()
  let max = 0
  for (const t of tables) {
    const id = idOf(t)
    if (p) {
      if (id.startsWith(p)) {
        const n = parseInt(id.slice(p.length), 10)
        if (!isNaN(n)) max = Math.max(max, n)
      }
    } else if (/^\d+$/.test(id)) {
      max = Math.max(max, parseInt(id, 10))
    }
  }
  return max + 1
}

/**
 * Agrega mesas al set actual SIN reemplazarlo. Lee las mesas frescas desde la
 * BD (no desde el estado de React) para que dos altas seguidas no se pisen.
 * Continúa la numeración existente y omite identificadores repetidos.
 * Devuelve cuántas mesas se agregaron realmente.
 */
export async function addTables(
  restaurantId: string,
  opts: { count: number; prefix?: string; from?: number; sectorId?: string | null }
): Promise<number> {
  const current = await posDb.posTables.where('restaurant_id').equals(restaurantId).toArray()
  const existing = new Set(current.map(idOf))
  const prefix = (opts.prefix || '').trim()
  const from = opts.from ?? nextTableNumber(current, prefix)
  let maxNum = current.reduce((m, t) => Math.max(m, t.number), 0)
  const rows: PosTable[] = [...current]
  let added = 0
  for (let k = 0; k < opts.count; k++) {
    const idx = from + k
    const id = prefix ? `${prefix}${idx}` : String(idx)
    if (existing.has(id)) continue
    existing.add(id)
    const number = prefix ? ++maxNum : idx
    rows.push({
      id: uuidv4(), restaurant_id: restaurantId, number,
      label: prefix ? id : undefined, sector_id: opts.sectorId ?? undefined,
      x: (rows.length % 5), y: Math.floor(rows.length / 5), active: true,
    })
    added++
  }
  if (added > 0) await configureTables({ tables: rows })
  return added
}

/** Agrega una sola mesa con nombre propio (VIP, Barra, 12). false si ya existe. */
export async function addCustomTable(restaurantId: string, label: string, sectorId?: string | null): Promise<boolean> {
  const name = label.trim()
  if (!name) return false
  const current = await posDb.posTables.where('restaurant_id').equals(restaurantId).toArray()
  if (current.some(t => idOf(t) === name)) return false
  const isNum = /^\d+$/.test(name)
  const maxNum = current.reduce((m, t) => Math.max(m, t.number), 0)
  const row: PosTable = {
    id: uuidv4(), restaurant_id: restaurantId,
    number: isNum ? parseInt(name, 10) : maxNum + 1,
    label: isNum ? undefined : name,
    sector_id: sectorId ?? undefined,
    x: (current.length % 5), y: Math.floor(current.length / 5), active: true,
  }
  await configureTables({ tables: [...current, row] })
  return true
}

/** Elimina una mesa leyendo el set fresco desde la BD. */
export async function removeTable(restaurantId: string, tableId: string): Promise<void> {
  const current = await posDb.posTables.where('restaurant_id').equals(restaurantId).toArray()
  await configureTables({ tables: current.filter(t => t.id !== tableId) })
}

export async function updateTableSector(tableId: string, sectorId: string | null): Promise<void> {
  const table = await posDb.posTables.get(tableId)
  if (!table) return
  const all = await posDb.posTables.where('restaurant_id').equals(table.restaurant_id).toArray()
  const updated = all.map(t => t.id === tableId ? { ...t, sector_id: sectorId ?? undefined } : t)
  await configureTables({ tables: updated })
}

export async function updateTableLabel(tableId: string, label: string): Promise<void> {
  const table = await posDb.posTables.get(tableId)
  if (!table) return
  const all = await posDb.posTables.where('restaurant_id').equals(table.restaurant_id).toArray()
  const updated = all.map(t => t.id === tableId ? { ...t, label: label || undefined } : t)
  await configureTables({ tables: updated })
}

export async function saveSectors(restaurantId: string, sectors: { name: string; position: number }[]): Promise<void> {
  const rows: PosSector[] = sectors.map(s => ({
    id: uuidv4(),
    restaurant_id: restaurantId,
    name: s.name,
    position: s.position,
  }))
  await configureSectors({ sectors: rows })
}
