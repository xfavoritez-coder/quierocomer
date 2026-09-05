import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/flujo/resumen?restaurantId=X&month=YYYY-MM
// Sin month → balance global acumulado (todos los movimientos sin justificar de cualquier mes)
// Con month → datos solo del mes indicado
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const monthParam = req.nextUrl.searchParams.get("month"); // "2026-08" — si omite, retorna global
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const dateFilter = monthParam
    ? (() => {
        const [y, m] = monthParam.split("-").map(Number);
        return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
      })()
    : undefined; // sin filtro de fecha → todos los meses

  // Agentes del restaurante
  const agents = await prisma.cashAgent.findMany({
    where: { restaurantId, isActive: true },
    select: { id: true, name: true },
  });

  if (agents.length === 0) return NextResponse.json({ agents: [] });

  const agentIds = agents.map((a) => a.id);

  // Retiros del banco por agente (sum of debit) — excluir RECONCILED (ej: sueldo categorizado directamente)
  const bankMovements = await prisma.bankMovement.findMany({
    where: {
      restaurantId,
      agentId: { in: agentIds },
      ...(dateFilter ? { date: dateFilter } : {}),
      status: { not: "RECONCILED" },
    },
    select: { agentId: true, debit: true },
  });

  // Lo reportado en /flujo (FinancialEntry source FLUJO — solo lo que el agente registró)
  const reported = await prisma.financialEntry.aggregate({
    where: {
      restaurantId,
      source: "FLUJO",
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    _sum: { amount: true },
  });

  // Agrupar retiros por agente
  const retiradoByAgent: Record<string, number> = {};
  for (const mv of bankMovements) {
    if (!mv.agentId) continue;
    retiradoByAgent[mv.agentId] = (retiradoByAgent[mv.agentId] || 0) + (mv.debit || 0);
  }

  const totalRetirado = Object.values(retiradoByAgent).reduce((s, v) => s + v, 0);
  const totalReportado = reported._sum.amount || 0;

  return NextResponse.json({
    month: monthParam ?? "global",
    totalRetirado,
    totalReportado,
    sinJustificar: Math.max(0, totalRetirado - totalReportado),
    agents: agents.map((a) => ({
      ...a,
      retirado: retiradoByAgent[a.id] || 0,
    })),
  });
}
