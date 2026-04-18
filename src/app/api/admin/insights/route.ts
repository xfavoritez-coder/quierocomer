import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateInsights } from "@/lib/genio/generateInsights";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

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
    const { restaurantId, action } = await req.json();

    if (action === "generate") {
      // Clear old insights
      await prisma.genioInsight.updateMany({
        where: { restaurantId, status: "active" },
        data: { status: "dismissed" },
      });

      const insights = await generateInsights(restaurantId);

      const created = [];
      for (const i of insights) {
        const insight = await prisma.genioInsight.create({
          data: {
            restaurantId,
            type: i.type,
            title: i.title,
            body: i.body,
            priority: i.priority,
            data: i.data,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
        created.push(insight);
      }

      return NextResponse.json({ ok: true, insights: created });
    }

    if (action === "dismiss") {
      const { insightId } = await req.json();
      await prisma.genioInsight.update({
        where: { id: insightId },
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
