import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertOwnership } from '@/lib/ecommerce/panelAuth'

/**
 * GET /api/panel/ecommerce/venta-historica?restaurantId=X[&year=2026]
 *
 * Returns historical daily sales from VentaDia (source: xls-import or sync).
 * Used for the year-long chart, monthly projection and day-of-week benchmark.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'Falta restaurantId' }, { status: 400 })
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const year = parseInt(req.nextUrl.searchParams.get('year') || '2026', 10)
  const from = new Date(`${year}-01-01T00:00:00Z`)
  const to   = new Date(`${year}-12-31T23:59:59Z`)

  const rows = await prisma.ventaDia.findMany({
    where: { restaurantId, fecha: { gte: from, lte: to } },
    orderBy: { fecha: 'asc' },
    select: {
      fecha: true, totalBruto: true, totalNeto: true, numOrdenes: true,
      ventaMercat: true, ventaUber: true, costoDespacho: true, margenPct: true, source: true,
    },
  })

  // ── Aggregate by month ───────────────────────────────────────────────
  type MonthAgg = {
    yearMonth: string
    totalBruto: number; totalNeto: number; numOrdenes: number
    ventaMercat: number; ventaUber: number; costoDespacho: number
    numDias: number; margenSum: number; margenCount: number
    avgMargen: number | null
  }
  const monthMap = new Map<string, MonthAgg>()

  for (const r of rows) {
    const ym = r.fecha.toISOString().slice(0, 7) // "2026-01"
    const a = monthMap.get(ym) ?? {
      yearMonth: ym,
      totalBruto: 0, totalNeto: 0, numOrdenes: 0,
      ventaMercat: 0, ventaUber: 0, costoDespacho: 0,
      numDias: 0, margenSum: 0, margenCount: 0, avgMargen: null,
    }
    a.totalBruto    += r.totalBruto
    a.totalNeto     += r.totalNeto
    a.numOrdenes    += r.numOrdenes
    a.ventaMercat   += r.ventaMercat
    a.ventaUber     += r.ventaUber
    a.costoDespacho += r.costoDespacho
    a.numDias       += 1
    if (r.margenPct != null) { a.margenSum += r.margenPct; a.margenCount++ }
    monthMap.set(ym, a)
  }

  const months = Array.from(monthMap.values()).map(a => ({
    yearMonth: a.yearMonth,
    totalBruto: Math.round(a.totalBruto),
    totalNeto: Math.round(a.totalNeto),
    numOrdenes: a.numOrdenes,
    ventaMercat: Math.round(a.ventaMercat),
    ventaUber: Math.round(a.ventaUber),
    costoDespacho: Math.round(a.costoDespacho),
    numDias: a.numDias,
    avgMargen: a.margenCount > 0 ? Math.round((a.margenSum / a.margenCount) * 10) / 10 : null,
  }))

  // ── Day-of-week stats (0=Sun, 1=Mon … 6=Sat) ───────────────────────
  type DowAgg = { sum: number; count: number }
  const dowMap = new Map<number, DowAgg>()
  for (const r of rows) {
    if (r.totalBruto <= 0) continue
    const dow = r.fecha.getUTCDay() // Sunday=0 … Saturday=6
    const a = dowMap.get(dow) ?? { sum: 0, count: 0 }
    a.sum += r.totalBruto; a.count++
    dowMap.set(dow, a)
  }
  const dowStats = Array.from({ length: 7 }, (_, dow) => {
    const a = dowMap.get(dow)
    return { dow, avg: a ? Math.round(a.sum / a.count) : 0, count: a?.count ?? 0 }
  })

  // ── Current month daily series (for projection widget) ──────────────
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
  const currentYm = todayStr.slice(0, 7)
  const currentMonthDays = rows
    .filter(r => r.fecha.toISOString().slice(0, 7) === currentYm)
    .map(r => ({
      fecha: r.fecha.toISOString().slice(0, 10),
      totalBruto: Math.round(r.totalBruto),
      ventaMercat: Math.round(r.ventaMercat),
      ventaUber: Math.round(r.ventaUber),
    }))

  // ── Last 7 days vs same 7 days a year ago comparison ────────────────
  const todayDate = new Date(`${todayStr}T12:00:00-03:00`)
  const last7Start = new Date(todayDate); last7Start.setDate(todayDate.getDate() - 7)
  const last7Rows = rows.filter(r => r.fecha >= last7Start && r.fecha <= todayDate)
  const last7Total = Math.round(last7Rows.reduce((s, r) => s + r.totalBruto, 0))

  return NextResponse.json({ months, dowStats, currentMonthDays, last7Total, totalRows: rows.length })
}
