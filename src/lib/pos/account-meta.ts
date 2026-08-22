import { posDb } from './db'
import { notifyDbChange } from './notify'

export async function updateAccountCovers(accountId: string, covers: number): Promise<void> {
  await posDb.accounts.update(accountId, { covers })
  notifyDbChange()
}

export async function updateAccountGarzon(accountId: string, name: string): Promise<void> {
  await posDb.accounts.update(accountId, { opened_by_name: name })
  notifyDbChange()
}
