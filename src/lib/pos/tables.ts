import { v4 as uuidv4 } from 'uuid'
import { posDb } from './db'
import { notifyDbChange } from './notify'
import type { PosTable } from './types'

export async function saveTables(restaurantId: string, tables: { number: number; label?: string }[]): Promise<void> {
  await posDb.posTables.where('restaurant_id').equals(restaurantId).delete()
  const rows: PosTable[] = tables.map((t, i) => ({
    id: uuidv4(),
    restaurant_id: restaurantId,
    number: t.number,
    label: t.label,
    x: (i % 5) * 1,
    y: Math.floor(i / 5),
    active: true,
  }))
  await posDb.posTables.bulkPut(rows)
  notifyDbChange()
}
