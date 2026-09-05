import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/flujo/resumen?restaurantId=X&month=YYYY-MM
// Sin month → breakdown por mes de todos los movimientos sin justificar
// Con month → datos solo del mes indicado
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const monthParam = req.nextUrl.searchParams.get("month");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const agents = await prisma.cashAgent.findMany({
    where: { restaurantId, isActive: true },
    select: { id: true, name: true },
  });

  if (agents.length === 0) return NextResponse.json({ agents: [], months: [] });

  const agentIds = agents.map((a) => a.id);

  if (monthParam) {
    // Modo mes específico (lo usa /panel/administracion/flujo)
    const [y, m] = monthParam.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const bankMovements = await prisma.bankMovement.findMany({
      where: { restaurantId, agentId: { in: agentIds }, date: { gte: start, lt: end }, status: { not: "RECONCILED" } },
      select: { agentId: true, debit: true },
    });
    const reported = await prisma.financialEntry.aggregate({
      where: { restaurantId, source: "FLUJO", date: { gte: start, lt: end } },
      _sum: { amount: true },
    });

    const retiradoByAgent: Record<string, number> = {};
    for (const mv of bankMovements) {
      if (!mv.agentId) continue;
      retiradoByAgent[mv.agentId] = (retiradoByAgent[mv.agentId] || 0) + (mv.debit || 0);
    }
    const totalRetirado = Object.values(retiradoByAgent).reduce((s, v) => s + v, 0);
    const totalReportado = reported._sum.amount || 0;

    return NextResponse.json({
      month: monthParam,
      totalRetirado,
      totalReportado,
      sinJustificar: Math.max(0, totalRetirado - totalReportado),
      agents: agents.map((a) => ({ ...a, retirado: retiradoByAgent[a.id] || 0 })),
    });
  }

  // Modo global: breakdown por mes
  const bankMovements = await prisma.bankMovement.findMany({
    where: { restaurantId, agentId: { in: agentIds }, status: { not: "RECONCILED" } },
    select: { date: true, debit: true },
  });
  const reportedEntries = await prisma.financialEntry.findMany({
    where: { restaurantId, source: "FLUJO" },
    select: { date: true, amount: true },
  });

  // Agrupar por mes
  const retiradoByMonth: Record<string, number> = {};
  for (const mv of bankMovements) {
    const k = toMonthKey(mv.date);
    retiradoByMonth[k] = (retiradoByMonth[k] || 0) + (mv.debit || 0);
  }
  const reportadoByMonth: Record<string, number> = {};
  for (const e of reportedEntries) {
    const k = toMonthKey(e.date);
    reportadoByMonth[k] = (reportadoByMonth[k] || 0) + e.amount;
  }

  // Unir todos los meses con actividad
  const allMonths = new Set([...Object.keys(retiradoByMonth), ...Object.keys(reportadoByMonth)]);
  const months = Array.from(allMonths)
    .sort()
    .map((k) => {
      const totalRetirado = retiradoByMonth[k] || 0;
      const totalReportado = reportadoByMonth[k] || 0;
      return { month: k, totalRetirado, totalReportado, sinJustificar: Math.max(0, totalRetirado - totalReportado) };
    });

  const totalSinJustificar = months.reduce((s, m) => s + m.sinJustificar, 0);

  return NextResponse.json({ month: "global", months, totalSinJustificar, agents });
}
