import { v4 as uuidv4 } from 'uuid'
import { posDb } from './db'
import { notifyDbChange } from './notify'
import type { PosStaff } from './types'

export async function saveGarzon(restaurantId: string, name: string): Promise<PosStaff> {
  const garzon: PosStaff = {
    id: uuidv4(),
    restaurant_id: restaurantId,
    name: name.trim(),
    pin_hash: '',
    role: 'garzon',
    active: true,
  }
  await posDb.staff.put(garzon)
  notifyDbChange()
  return garzon
}

export async function deleteGarzon(id: string): Promise<void> {
  await posDb.staff.delete(id)
  notifyDbChange()
}

export async function seedDefaultGarzones(restaurantId: string): Promise<void> {
  const existing = await posDb.staff.where('restaurant_id').equals(restaurantId).count()
  if (existing > 0) return
  await saveGarzon(restaurantId, 'Garzón 1')
  await saveGarzon(restaurantId, 'Garzón 2')
}
