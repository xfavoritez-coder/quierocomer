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
