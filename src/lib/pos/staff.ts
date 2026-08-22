import { v4 as uuidv4 } from 'uuid'
import { posDb } from './db'
import { saveStaff, deleteStaff } from './events'
import type { PosStaff } from './types'

// ── One-time migration: emit events for staff created before sync ──

export async function migrateLocalStaffToEvents(restaurantId: string): Promise<void> {
  const hasEvent = await posDb.events
    .where('restaurant_id').equals(restaurantId)
    .filter(e => e.type === 'staff_saved')
    .first()
  if (hasEvent) return

  const staff = await posDb.staff.where('restaurant_id').equals(restaurantId).toArray()
  for (const s of staff) {
    await saveStaff({ staff: { id: s.id, name: s.name, pin_hash: s.pin_hash, role: s.role, active: s.active } })
  }
}

export async function saveGarzon(restaurantId: string, name: string): Promise<PosStaff> {
  const garzon: PosStaff = {
    id: uuidv4(),
    restaurant_id: restaurantId,
    name: name.trim(),
    pin_hash: '',
    role: 'garzon',
    active: true,
  }
  await saveStaff({ staff: { id: garzon.id, name: garzon.name, pin_hash: garzon.pin_hash, role: garzon.role, active: garzon.active } })
  return garzon
}

export async function deleteGarzon(id: string): Promise<void> {
  await deleteStaff({ staff_id: id })
}

export async function seedDefaultGarzones(restaurantId: string): Promise<void> {
  const existing = await posDb.staff.where('restaurant_id').equals(restaurantId).count()
  if (existing > 0) return
  await saveGarzon(restaurantId, 'Garzón 1')
  await saveGarzon(restaurantId, 'Garzón 2')
}
