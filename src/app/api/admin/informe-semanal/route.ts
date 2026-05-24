import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/**
 * GET /api/admin/informe-semanal
 * Returns all weekly email logs with open/click tracking.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const logs = await prisma.emailLog.findMany({
    where: { purpose: "weekly_summary" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Enrich with restaurant info
  const enriched = await Promise.all(logs.map(async (log) => {
    // Find restaurant by email (owner email)
    const owner = await prisma.restaurantOwner.findUnique({
      where: { email: log.to },
      select: { name: true, restaurants: { select: { name: true, slug: true, isDemo: true, plan: true }, take: 1 } },
    }).catch(() => null);

    const rest = owner?.restaurants?.[0] || null;

    return {
      id: log.id,
      to: log.to,
      subject: log.subject,
      status: log.status,
      errorMsg: log.errorMsg,
      createdAt: log.createdAt,
      ownerName: owner?.name || null,
      restaurantName: rest?.name || null,
      slug: rest?.slug || null,
      isDemo: rest?.isDemo || false,
      plan: rest?.plan || null,
    };
  }));

  // Stats
  const total = logs.length;
  const sent = logs.filter(l => l.status === "sent").length;
  const failed = logs.filter(l => l.status === "failed").length;

  // Group by week
  const byWeek = new Map<string, number>();
  for (const l of logs) {
    const week = l.createdAt.toISOString().slice(0, 10);
    byWeek.set(week, (byWeek.get(week) || 0) + 1);
  }

  return NextResponse.json({
    logs: enriched,
    stats: { total, sent, failed },
    byWeek: Object.fromEntries(byWeek),
  });
}
