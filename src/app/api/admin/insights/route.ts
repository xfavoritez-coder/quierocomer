import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateInsights } from "@/lib/genio/generateInsights";
import { generateGlobalInsights } from "@/lib/genio/generateGlobalInsights";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const mode = req.nextUrl.searchParams.get("mode"); // "global" for superadmin

  if (mode === "global") {
    const insights = await prisma.genioInsight.findMany({
      where: { restaurantId: "global", status: "active" },
      orderBy: { priority: "asc" },
    });
    return NextResponse.json({ insights });
  }

  if (!restaurantId) return NextResponse.json({ insights: [] });

  const insights = await prisma.genioInsight.findMany({
    where: { restaurantId, status: "active" },
    orderBy: { priority: "asc" },
  });

  return NextResponse.json({ insights });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const { restaurantId, action, mode } = await req.json();

    if (action === "generate") {
      const isGlobal = mode === "global" || !restaurantId;

      // Clear old insights
      await prisma.genioInsight.updateMany({
        where: { restaurantId: isGlobal ? "global" : restaurantId, status: "active" },
        data: { status: "dismissed" },
      });

      const insights = isGlobal
        ? await generateGlobalInsights()
        : await generateInsights(restaurantId);

      const created = [];
      for (const i of insights) {
        const insight = await prisma.genioInsight.create({
          data: {
            restaurantId: isGlobal ? "global" : restaurantId,
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
      const body = await req.json();
      await prisma.genioInsight.update({
        where: { id: body.insightId },
        data: { status: "dismissed", dismissedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Insights error:", error);
    return NextResponse.json({ error: error.message || "Error" }, { status: 500 });
  }
}
