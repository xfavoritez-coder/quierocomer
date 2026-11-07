/**
 * Importa el resumen de ventas por producto de Toteat hacia VentaProductoMes:
 *   - Recoleta: XLS mensuales Ene–Sep 2026 (valores en miles de CLP)
 *   - La Florida: CSV Octubre 2026 (valores en CLP real)
 *
 * Uso: npx tsx scripts/import-toteat-products.ts
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { Client } from 'pg'

const DIRECT_URL = 'postgresql://postgres.awbeyxfqtrdfhengabmw:quierocomer6868@aws-1-us-east-1.pooler.supabase.com:5432/postgres'

const RECOLETA_ID = 'cmvcjbx090001jn074i0eg9zu'
const LF_ID       = 'cmubc0yoq0001jv041si8zicn'

const RECOLETA_MONTHS: { file: string; yearMonth: string }[] = [
  { file: 'Enero.xls',      yearMonth: '2026-01' },
  { file: 'Febrero.xls',    yearMonth: '2026-02' },
  { file: 'Marzo.xls',      yearMonth: '2026-03' },
  { file: 'Abril.xls',      yearMonth: '2026-04' },
  { file: 'Mayo.xls',       yearMonth: '2026-05' },
  { file: 'Junio.xls',      yearMonth: '2026-06' },
  { file: 'Julio.xls',      yearMonth: '2026-07' },
  { file: 'Agosto.xls',     yearMonth: '2026-08' },
  { file: 'Septiembre.xls', yearMonth: '2026-09' },
]

const RECOLETA_DIR = path.join(import.meta.dirname ?? __dirname, '..', 'Toteat', 'RECOLETA', 'Resumen de ventas')
const LF_DIR       = path.join(import.meta.dirname ?? __dirname, '..', 'Toteat', 'LF')

const EXCLUDE_CODES = new Set(['TOTEATDVYCOST'])

function shouldExclude(code: string, name: string): boolean {
  if (EXCLUDE_CODES.has(code)) return true
  if (name.startsWith('Costo Delivery') || name.startsWith('PRUEBA')) return true
  return false
}

function parseXlsRevenue(raw: unknown): number {
  if (typeof raw === 'string') return parseInt(raw.replace(/\./g, '').trim(), 10) || 0
  if (typeof raw === 'number') return Math.round(raw * 1000)
  return 0
}

function parseCsvRevenue(raw: unknown): number {
  if (typeof raw === 'string') return parseInt(raw.replace(/\./g, '').trim(), 10) || 0
  if (typeof raw === 'number') return Math.round(raw)
  return 0
}

function parseQty(raw: unknown): number {
  if (typeof raw === 'number') return Math.max(0, Math.round(raw))
  if (typeof raw === 'string') return parseInt(raw.replace(/\./g, '').trim(), 10) || 0
  return 0
}

function makeId(restaurantId: string, yearMonth: string, code: string | null, name: string): string {
  // Hash the key so IDs are always unique and fixed-length without truncation collisions
  const key = `${restaurantId}|${yearMonth}|${code || name}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(31, hash) + key.charCodeAt(i) | 0
  }
  const h = (hash >>> 0).toString(16).padStart(8, '0')
  const safe = `${restaurantId}_${yearMonth}_${(code || name).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}_${h}`
  return safe
}

async function upsertProduct(
  client: Client,
  restaurantId: string,
  yearMonth: string,
  code: string | null,
  name: string,
  qty: number,
  revenue: number,
) {
  const id = makeId(restaurantId, yearMonth, code, name)
  await client.query(
    `INSERT INTO "VentaProductoMes" ("id","restaurantId","yearMonth","source","productCode","productName","qty","revenue")
     VALUES ($1,$2,$3,'toteat',$4,$5,$6,$7)
     ON CONFLICT ("id") DO UPDATE SET "qty"=$6,"revenue"=$7,"productName"=$5`,
    [id, restaurantId, yearMonth, code, name, qty, revenue],
  )
}

async function importRecoletaMonth(client: Client, file: string, yearMonth: string) {
  const filePath = path.join(RECOLETA_DIR, file)
  if (!fs.existsSync(filePath)) { console.warn(`  ⚠️  No encontrado: ${filePath}`); return }
  const wb = XLSX.readFile(filePath)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  let inserted = 0, skipped = 0
  for (const row of rows) {
    const code = String(row['ID'] ?? '').trim()
    const name = String(row['Producto'] ?? '').trim()
    if (!name || shouldExclude(code, name)) { skipped++; continue }
    const qty = parseQty(row['Cantidad'])
    const revenue = parseXlsRevenue(row['Valor Venta'])
    if (qty === 0 && revenue === 0) { skipped++; continue }
    await upsertProduct(client, RECOLETA_ID, yearMonth, code || null, name, qty, revenue)
    inserted++
  }
  console.log(`  ${yearMonth}: ${inserted} productos, ${skipped} omitidos`)
}

async function importLFCsv(client: Client) {
  const yearMonth = '2026-10'
  const filePath = path.join(LF_DIR, 'export.csv')
  if (!fs.existsSync(filePath)) { console.warn(`  ⚠️  No encontrado: ${filePath}`); return }
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = content.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  let inserted = 0, skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,))/g) ?? lines[i].split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? '').replace(/^"|"$/g, '').trim() })
    const code = row['ID'] ?? ''
    const name = row['Producto'] ?? ''
    if (!name || shouldExclude(code, name)) { skipped++; continue }
    const qty = parseQty(row['Cantidad'])
    const revenue = parseCsvRevenue(row['Valor Venta'])
    if (qty === 0 && revenue === 0) { skipped++; continue }
    await upsertProduct(client, LF_ID, yearMonth, code || null, name, qty, revenue)
    inserted++
  }
  console.log(`  2026-10 (LF): ${inserted} productos, ${skipped} omitidos`)
}

async function main() {
  console.log('🔄 Importando productos Toteat → VentaProductoMes\n')
  const client = new Client({ connectionString: DIRECT_URL })
  await client.connect()

  console.log('📂 Recoleta (XLS mensuales):')
  for (const { file, yearMonth } of RECOLETA_MONTHS) {
    process.stdout.write(`  → ${file} `)
    await importRecoletaMonth(client, file, yearMonth)
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n📂 La Florida (CSV Octubre):')
  await importLFCsv(client)

  const rec = await client.query(`SELECT COUNT(*) FROM "VentaProductoMes" WHERE "restaurantId"=$1`, [RECOLETA_ID])
  const lf  = await client.query(`SELECT COUNT(*) FROM "VentaProductoMes" WHERE "restaurantId"=$1`, [LF_ID])
  console.log(`\n✅ Listo. Recoleta: ${rec.rows[0].count} filas · La Florida: ${lf.rows[0].count} filas`)
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
