import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertOwnership } from "@/lib/ecommerce/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/loyalty/report?restaurantId=X
 * KPIs del programa de lealtad: miembros, sellos, canjes.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const program = await prisma.loyaltyProgram.findUnique({
    where: { restaurantId },
    select: { id: true, name: true, stampGoal: true, active: true, rewards: true, stampIcon: true },
  });
  if (!program) return NextResponse.json({ error: "Sin programa" }, { status: 404 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [members, transactions, membersThisMonth, membersPrevMonth] = await Promise.all([
    prisma.loyaltyMember.findMany({
      where: { programId: program.id, revoked: false },
      select: { id: true, stamps: true, completedCards: true, enrolledAt: true, lastStampAt: true, name: true, phone: true },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.loyaltyTransaction.findMany({
      where: { member: { programId: program.id } },
      select: { type: true, amount: true, createdAt: true },
    }),
    prisma.loyaltyMember.count({ where: { programId: program.id, revoked: false, enrolledAt: { gte: startOfMonth } } }),
    prisma.loyaltyMember.count({ where: { programId: program.id, revoked: false, enrolledAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
  ]);

  // Activos este mes = tuvieron un sello este mes
  const activeThisMonth = members.filter(m => m.lastStampAt && m.lastStampAt >= startOfMonth).length;

  // Distribución por rango de sellos
  const goal = program.stampGoal || 8;
  const stampsDistribution = [
    { label: "0 sellos", count: members.filter(m => m.stamps === 0).length },
    { label: `1–${Math.floor(goal * 0.4)} sellos`, count: members.filter(m => m.stamps >= 1 && m.stamps <= Math.floor(goal * 0.4)).length },
    { label: `${Math.floor(goal * 0.4) + 1}–${goal - 1} sellos`, count: members.filter(m => m.stamps > Math.floor(goal * 0.4) && m.stamps < goal).length },
    { label: `${goal} sellos (completa)`, count: members.filter(m => m.stamps >= goal).length },
  ];

  // Totales de sellos y canjes
  const totalStampsIssued = transactions.filter(t => t.type === "STAMP_ADD").reduce((s, t) => s + (t.amount || 1), 0);
  const totalCardsCompleted = members.reduce((s, m) => s + (m.completedCards || 0), 0);
  const totalRedemptions = transactions.filter(t => t.type === "REWARD_REDEEM").length;

  // Crecimiento mensual (últimos 6 meses)
  const monthlyGrowth: { month: string; newMembers: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label = new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit" }).format(ms);
    const newMembers = members.filter(m => m.enrolledAt >= ms && m.enrolledAt <= me).length;
    monthlyGrowth.push({ month: label, newMembers });
  }

  // Últimos 10 miembros inscritos
  const recentMembers = members.slice(0, 10).map(m => ({
    name: m.name || "Sin nombre",
    phone: m.phone || "",
    stamps: m.stamps,
    completedCards: m.completedCards,
    enrolledAt: m.enrolledAt.toISOString(),
    lastStampAt: m.lastStampAt?.toISOString() ?? null,
  }));

  return NextResponse.json({
    program: { name: program.name, stampGoal: goal, active: program.active, stampIcon: program.stampIcon, rewards: program.rewards },
    members: {
      total: members.length,
      newThisMonth: membersThisMonth,
      newPrevMonth: membersPrevMonth,
      activeThisMonth,
      stampsDistribution,
    },
    stamps: {
      totalIssued: totalStampsIssued,
      totalCardsCompleted,
      totalRedemptions,
    },
    monthlyGrowth,
    recentMembers,
  });
}
