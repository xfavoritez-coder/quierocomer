/**
 * Backfill SERVER-SIDE de la config del POS desde pos_events → PosTable/PosSector/
 * PosStaff. Independiente del Dexie del cliente (que puede fallar al abrir por el
 * conflicto de versión), así TODOS los locales quedan migrados de una.
 *
 * IDEMPOTENTE: para cada local, solo llena la tabla que esté VACÍA (no pisa lo que
 * ya migró un dispositivo ni ediciones nuevas). Proyección:
 *  - tables_configured / sectors_configured: el ÚLTIMO evento por local trae el
 *    array completo (= estado actual).
 *  - staff_saved / staff_deleted: se replayean en orden (server_seq) por local.
 *
 * Correr: npx tsx scripts/backfill-pos-config-from-events.ts
 */
import { config } from 'dotenv'; config({ path: '.env.local' }); config()
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } })

type Row = { restaurant_id: string; server_seq: bigint; type: string; payload: any }

async function main() {
  const dryRun = process.argv.includes('--dry')

  // ÚLTIMO tables_configured / sectors_configured por local (array completo).
  const latestArrays = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT DISTINCT ON (restaurant_id, type) restaurant_id, server_seq, type, payload
    FROM pos_events
    WHERE type IN ('tables_configured','sectors_configured')
    ORDER BY restaurant_id, type, server_seq DESC
  `)
  // TODOS los staff_saved / staff_deleted en orden (para replay).
  const staffEvents = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT restaurant_id, server_seq, type, payload
    FROM pos_events
    WHERE type IN ('staff_saved','staff_deleted')
    ORDER BY restaurant_id, server_seq ASC
  `)

  const tablesByRid = new Map<string, any[]>()
  const sectorsByRid = new Map<string, any[]>()
  for (const r of latestArrays) {
    if (r.type === 'tables_configured') tablesByRid.set(r.restaurant_id, Array.isArray(r.payload?.tables) ? r.payload.tables : [])
    else sectorsByRid.set(r.restaurant_id, Array.isArray(r.payload?.sectors) ? r.payload.sectors : [])
  }
  // Replay de staff por local.
  const staffByRid = new Map<string, Map<string, any>>()
  for (const r of staffEvents) {
    const m = staffByRid.get(r.restaurant_id) ?? new Map<string, any>()
    if (r.type === 'staff_saved' && r.payload?.staff?.id) m.set(r.payload.staff.id, r.payload.staff)
    else if (r.type === 'staff_deleted' && r.payload?.staff_id) m.delete(r.payload.staff_id)
    staffByRid.set(r.restaurant_id, m)
  }

  const rids = new Set<string>([...tablesByRid.keys(), ...sectorsByRid.keys(), ...staffByRid.keys()])
  console.log(`Locales con config en pos_events: ${rids.size}${dryRun ? ' (DRY RUN)' : ''}`)

  let filledT = 0, filledS = 0, filledG = 0
  for (const rid of rids) {
    const [nt, ns, ng] = await Promise.all([
      prisma.posTable.count({ where: { restaurantId: rid } }),
      prisma.posSector.count({ where: { restaurantId: rid } }),
      prisma.posStaff.count({ where: { restaurantId: rid } }),
    ])

    // Sectores primero (las mesas referencian sectorId).
    const sectors = sectorsByRid.get(rid) ?? []
    if (ns === 0 && sectors.length) {
      const data = sectors.map((s: any, i: number) => ({
        id: String(s.id), restaurantId: rid, name: String(s.name || '').trim() || 'Sector',
        position: Number.isFinite(Number(s.position)) ? Math.round(Number(s.position)) : i,
      }))
      if (!dryRun) await prisma.posSector.createMany({ data, skipDuplicates: true })
      filledS++; console.log(`  [${rid.slice(-6)}] sectores: +${data.length}`)
    }

    const tables = tablesByRid.get(rid) ?? []
    if (nt === 0 && tables.length) {
      const data = tables.map((t: any) => ({
        id: String(t.id), restaurantId: rid, number: Math.round(Number(t.number) || 0),
        label: t.label ? String(t.label) : null, sectorId: t.sector_id ? String(t.sector_id) : null,
        x: Math.round(Number(t.x) || 0), y: Math.round(Number(t.y) || 0), active: t.active !== false,
      }))
      if (!dryRun) await prisma.posTable.createMany({ data, skipDuplicates: true })
      filledT++; console.log(`  [${rid.slice(-6)}] mesas: +${data.length}`)
    }

    const staff = [...(staffByRid.get(rid)?.values() ?? [])]
    if (ng === 0 && staff.length) {
      // dedup por nombre (histórico Dexie podía duplicar)
      const seen = new Set<string>()
      const data = staff.filter((s: any) => { const k = String(s.name || '').trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true })
        .map((s: any) => ({ id: String(s.id), restaurantId: rid, name: String(s.name).trim(), pinHash: String(s.pin_hash || ''), role: String(s.role || 'garzon'), active: s.active !== false }))
      if (data.length) { if (!dryRun) await prisma.posStaff.createMany({ data, skipDuplicates: true }); filledG++; console.log(`  [${rid.slice(-6)}] garzones: +${data.length}`) }
    }
  }
  console.log(`Listo. Locales llenados — mesas:${filledT} sectores:${filledS} garzones:${filledG}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
