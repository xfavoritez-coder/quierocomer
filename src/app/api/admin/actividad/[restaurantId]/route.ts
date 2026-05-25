import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/**
 * GET /api/admin/actividad/[restaurantId]?cursor=...&limit=30
 * Returns paginated activity log for a specific restaurant.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { restaurantId } = await params;
  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "30"), 100);

  const activities = await prisma.panelActivity.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = activities.length > limit;
  const data = hasMore ? activities.slice(0, limit) : activities;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return NextResponse.json({ activities: data, nextCursor });
}
