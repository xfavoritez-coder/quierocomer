import { v4 as uuidv4 } from 'uuid'
import type { PosTable, PosSector } from './types'
import { loadPosConfig, getPosConfigSnapshot, setTablesRemote, setSectorsRemote } from './configApi'

// Config de mesas/sectores SERVER-AUTHORITATIVE (/api/pos/config). Estas funciones
// calculan el set nuevo a partir del set ACTUAL (leído fresco del servidor) y lo
// reemplazan entero (mismo modelo "replace" que tenía el Dexie). Reemplaza el
// event-sourcing en pos_events, que un wipe borraba.

async function currentTables(restaurantId: string): Promise<PosTable[]> {
  await loadPosConfig(restaurantId, { force: true })
  return [...getPosConfigSnapshot(restaurantId).tables]
}
async function currentSectors(restaurantId: string): Promise<PosSector[]> {
  await loadPosConfig(restaurantId, { force: true })
  return [...getPosConfigSnapshot(restaurantId).sectors]
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
  await setTablesRemote(restaurantId, rows)
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
 * Agrega mesas al set actual SIN reemplazarlo. Lee las mesas frescas desde el
 * servidor (no desde el estado de React) para que dos altas seguidas no se pisen.
 * Continúa la numeración existente y omite identificadores repetidos.
 * Devuelve cuántas mesas se agregaron realmente.
 */
export async function addTables(
  restaurantId: string,
  opts: { count: number; prefix?: string; from?: number; sectorId?: string | null }
): Promise<number> {
  const current = await currentTables(restaurantId)
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
  if (added > 0) await setTablesRemote(restaurantId, rows)
  return added
}

/** Agrega una sola mesa con nombre propio (VIP, Barra, 12). false si ya existe. */
export async function addCustomTable(restaurantId: string, label: string, sectorId?: string | null): Promise<boolean> {
  const name = label.trim()
  if (!name) return false
  const current = await currentTables(restaurantId)
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
  await setTablesRemote(restaurantId, [...current, row])
  return true
}

/** Elimina una mesa leyendo el set fresco desde el servidor. */
export async function removeTable(restaurantId: string, tableId: string): Promise<void> {
  const current = await currentTables(restaurantId)
  await setTablesRemote(restaurantId, current.filter(t => t.id !== tableId))
}

export async function updateTableSector(restaurantId: string, tableId: string, sectorId: string | null): Promise<void> {
  const all = await currentTables(restaurantId)
  if (!all.some(t => t.id === tableId)) return
  await setTablesRemote(restaurantId, all.map(t => t.id === tableId ? { ...t, sector_id: sectorId ?? undefined } : t))
}

export async function updateTableLabel(restaurantId: string, tableId: string, label: string): Promise<void> {
  const all = await currentTables(restaurantId)
  if (!all.some(t => t.id === tableId)) return
  await setTablesRemote(restaurantId, all.map(t => t.id === tableId ? { ...t, label: label || undefined } : t))
}

/**
 * Agrega un sector CONSERVANDO los ids de los sectores existentes. Antes
 * (saveSectors) se regeneraban todos los ids con uuid nuevo, lo que dejaba
 * huérfanas las mesas de los sectores previos (su sector_id apuntaba a un id
 * que ya no existía). false si el nombre está vacío o repetido.
 */
export async function addSector(restaurantId: string, name: string): Promise<boolean> {
  const n = name.trim()
  if (!n) return false
  const current = await currentSectors(restaurantId)
  if (current.some(s => s.name.toLowerCase() === n.toLowerCase())) return false
  const sorted = [...current].sort((a, b) => a.position - b.position)
  const rows: PosSector[] = [
    ...sorted.map((s, i) => ({ ...s, position: i })),
    { id: uuidv4(), restaurant_id: restaurantId, name: n, position: sorted.length },
  ]
  await setSectorsRemote(restaurantId, rows)
  return true
}

/**
 * Elimina un sector conservando los ids de los demás, y reasigna sus mesas a
 * "sin sector" (conservando los ids de las mesas, no las borra).
 */
export async function removeSector(restaurantId: string, sectorId: string): Promise<void> {
  const tbls = await currentTables(restaurantId)
  if (tbls.some(t => t.sector_id === sectorId)) {
    await setTablesRemote(restaurantId, tbls.map(t => t.sector_id === sectorId ? { ...t, sector_id: undefined } : t))
  }
  const current = await currentSectors(restaurantId)
  const rows = current
    .filter(s => s.id !== sectorId)
    .sort((a, b) => a.position - b.position)
    .map((s, i) => ({ ...s, position: i }))
  await setSectorsRemote(restaurantId, rows)
}

export async function saveSectors(restaurantId: string, sectors: { name: string; position: number }[]): Promise<void> {
  const rows: PosSector[] = sectors.map(s => ({
    id: uuidv4(),
    restaurant_id: restaurantId,
    name: s.name,
    position: s.position,
  }))
  await setSectorsRemote(restaurantId, rows)
}
