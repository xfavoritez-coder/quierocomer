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

  const { entries, stats } = cached.value as { entries: any[]; stats: any };

  const slice = entries.slice(offset, offset + limit);
  return NextResponse.json({
    entries: slice,
    stats,
    total: entries.length,
    page,
    hasMore: offset + limit < entries.length,
  });
}
