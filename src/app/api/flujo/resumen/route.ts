import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/flujo/resumen?restaurantId=X&month=YYYY-MM
// Retorna cuánto retiró el agente del banco vs cuánto reportó en /flujo
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const monthParam = req.nextUrl.searchParams.get("month"); // "2026-08" opcional
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const now = new Date();
  const [y, m] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  // Agentes del restaurante
  const agents = await prisma.cashAgent.findMany({
    where: { restaurantId, isActive: true },
    select: { id: true, name: true },
  });

  if (agents.length === 0) return NextResponse.json({ agents: [] });

  const agentIds = agents.map((a) => a.id);

  // Retiros del banco por agente (sum of debit)
  const bankMovements = await prisma.bankMovement.findMany({
    where: {
      restaurantId,
      agentId: { in: agentIds },
      date: { gte: start, lt: end },
    },
    select: { agentId: true, debit: true },
  });

  // Lo reportado en /flujo (FinancialEntry source FLUJO del mes — solo lo que Carlos registró)
  const reported = await prisma.financialEntry.aggregate({
    where: {
      restaurantId,
      source: "FLUJO",
      date: { gte: start, lt: end },
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
    month: `${y}-${String(m).padStart(2, "0")}`,
    totalRetirado,
    totalReportado,
    sinJustificar: Math.max(0, totalRetirado - totalReportado),
    agents: agents.map((a) => ({
      ...a,
      retirado: retiradoByAgent[a.id] || 0,
    })),
  });
}
