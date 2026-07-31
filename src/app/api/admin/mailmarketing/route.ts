import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  // Aggregate by purpose (campaign)
  const raw = await prisma.emailLog.groupBy({
    by: ["purpose", "subject"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Get open/click counts per purpose
  const opens = await prisma.emailLog.groupBy({
    by: ["purpose"],
    where: { openedAt: { not: null } },
    _count: { id: true },
  });
  const clicks = await prisma.emailLog.groupBy({
    by: ["purpose"],
    where: { clickedAt: { not: null } },
    _count: { id: true },
  });

  // Get earliest createdAt per purpose (sent date)
  const dates = await prisma.emailLog.groupBy({
    by: ["purpose"],
    _min: { createdAt: true },
  });

  const openMap = Object.fromEntries(opens.map(r => [r.purpose, r._count.id]));
  const clickMap = Object.fromEntries(clicks.map(r => [r.purpose, r._count.id]));
  const dateMap = Object.fromEntries(dates.map(r => [r.purpose, r._min.createdAt]));

  const campaigns = raw.map(r => ({
    purpose: r.purpose,
    subject: r.subject,
    sent: r._count.id,
    opened: openMap[r.purpose] ?? 0,
    clicked: clickMap[r.purpose] ?? 0,
    sentAt: dateMap[r.purpose] ?? null,
  }));

  return NextResponse.json({ campaigns });
}
