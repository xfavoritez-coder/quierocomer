import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  const cached = await prisma.systemCache.findUnique({ where: { key: "lifecycle" } });

  if (!cached) {
    return NextResponse.json({ entries: [], stats: {}, total: 0, page, hasMore: false, stale: true });
  }

  const { entries, stats, computedAt } = cached.value as { entries: any[]; stats: any; computedAt?: string };

  const slice = entries.slice(offset, offset + limit);
  return NextResponse.json({
    entries: slice,
    stats,
    total: entries.length,
    page,
    hasMore: offset + limit < entries.length,
    computedAt: computedAt ?? null,
    cached: true,
  });
}

// POST: recompute lifecycle snapshot on demand (triggered by "Actualizar" button)
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const origin = new URL(req.url).origin;
  const secret = process.env.CRON_SECRET;

  const res = await fetch(`${origin}/api/cron/lifecycle-snapshot`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snapshot failed: ${text}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
