import { v4 as uuidv4 } from 'uuid'
import { loadPosConfig, getPosConfigSnapshot, addStaffRemote, deleteStaffRemote } from './configApi'
import type { StaffRole } from './types'

// Garzones/staff SERVER-AUTHORITATIVE (/api/pos/config). Reemplaza el
// event-sourcing en pos_events (staff_saved/staff_deleted), que un wipe borraba.

export async function saveGarzon(restaurantId: string, name: string): Promise<void> {
  await addStaffRemote(restaurantId, { id: uuidv4(), name: name.trim(), role: 'garzon', pin_hash: '', active: true })
}

export async function saveStaffMember(restaurantId: string, name: string, role: StaffRole): Promise<void> {
  await addStaffRemote(restaurantId, { id: uuidv4(), name: name.trim(), role, pin_hash: '', active: true })
}

export async function deleteGarzon(restaurantId: string, id: string): Promise<void> {
  await deleteStaffRemote(restaurantId, id)
}

export async function seedDefaultGarzones(restaurantId: string): Promise<void> {
  await loadPosConfig(restaurantId, { force: true })
  if (getPosConfigSnapshot(restaurantId).staff.length > 0) return
  await saveGarzon(restaurantId, 'Garzón 1')
  await saveGarzon(restaurantId, 'Garzón 2')
}
