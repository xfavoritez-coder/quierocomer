import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInsights } from "@/lib/genio/generateInsights";
import { generateGlobalInsights } from "@/lib/genio/generateGlobalInsights";
import {
  checkAdminAuth,
  isSuperAdmin,
  requireRestaurantForOwner,
  assertOwnsRestaurant,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    const mode = req.nextUrl.searchParams.get("mode");

    // Global mode: superadmin only
    if (mode === "global") {
      if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: "Solo superadmin puede ver insights globales" }, { status: 403 });
      }
      const insights = await prisma.genioInsight.findMany({
        where: { restaurantId: null, status: "active" },
        orderBy: { priority: "asc" },
      });
      return NextResponse.json({ insights });
    }

    // Owner must provide restaurantId
    const validated = await requireRestaurantForOwner(req, restaurantId);
    if (!validated) return NextResponse.json({ insights: [] });

    const insights = await prisma.genioInsight.findMany({
      where: { restaurantId: validated, status: "active" },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({ insights });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("Insights GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, action, mode, insightId } = await req.json();

    if (action === "generate") {
      const isGlobal = mode === "global" || !restaurantId;

      if (isGlobal && !isSuperAdmin(req)) {
        return NextResponse.json({ error: "Solo superadmin puede generar insights globales" }, { status: 403 });
      }

      if (!isGlobal) {
        await assertOwnsRestaurant(req, restaurantId);
      }

      // Clear old insights
      await prisma.genioInsight.updateMany({
        where: { restaurantId: isGlobal ? null : restaurantId, status: "active" },
        data: { status: "dismissed" },
      });

      const insights = isGlobal
        ? await generateGlobalInsights()
        : await generateInsights(restaurantId);

      const created = [];
      for (const i of insights) {
        const insight = await prisma.genioInsight.create({
          data: {
            restaurantId: isGlobal ? null : restaurantId,
            type: i.type,
            title: i.title,
            body: i.body,
            priority: i.priority,
            data: i.data,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        created.push(insight);
      }

      return NextResponse.json({ ok: true, insights: created });
    }

    if (action === "dismiss") {
      if (!insightId) return NextResponse.json({ error: "insightId required" }, { status: 400 });

      // Verify ownership of the insight
      const insight = await prisma.genioInsight.findUnique({ where: { id: insightId }, select: { restaurantId: true } });
      if (!insight) return NextResponse.json({ error: "Insight no encontrado" }, { status: 404 });
      if (insight.restaurantId) {
        await assertOwnsRestaurant(req, insight.restaurantId);
      } else if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: "Solo superadmin puede descartar insights globales" }, { status: 403 });
      }

      await prisma.genioInsight.update({
        where: { id: insightId },
        data: { status: "dismissed", dismissedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Insights error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
