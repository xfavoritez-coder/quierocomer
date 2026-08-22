import { v4 as uuidv4 } from 'uuid'
import { posDb } from './db'
import { notifyDbChange } from './notify'
import type { PosTable, PosSector } from './types'

export async function saveTables(restaurantId: string, tables: { number: number; label?: string; sector_id?: string }[]): Promise<void> {
  await posDb.posTables.where('restaurant_id').equals(restaurantId).delete()
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
  await posDb.posTables.bulkPut(rows)
  notifyDbChange()
}

export async function updateTableSector(tableId: string, sectorId: string | null): Promise<void> {
  await posDb.posTables.update(tableId, { sector_id: sectorId ?? undefined })
  notifyDbChange()
}

export async function updateTableLabel(tableId: string, label: string): Promise<void> {
  await posDb.posTables.update(tableId, { label: label || undefined })
  notifyDbChange()
}

export async function saveSectors(restaurantId: string, sectors: { name: string; position: number }[]): Promise<void> {
  await posDb.posSectors.where('restaurant_id').equals(restaurantId).delete()
  const rows: PosSector[] = sectors.map(s => ({
    id: uuidv4(),
    restaurant_id: restaurantId,
    name: s.name,
    position: s.position,
  }))
  await posDb.posSectors.bulkPut(rows)
  notifyDbChange()
}
