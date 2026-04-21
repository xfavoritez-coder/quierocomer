import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateSegment } from "@/lib/segments/evaluator";
import {
  checkAdminAuth,
  assertOwnsRestaurant,
  authErrorResponse,
} from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    await assertOwnsRestaurant(req, restaurantId);

    const segments = await prisma.segment.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ segments });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Segments GET error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, name, description, rules, isAuto } = await req.json();
    if (!restaurantId || !name || !rules) {
      return NextResponse.json({ error: "restaurantId, name, rules required" }, { status: 400 });
    }

    await assertOwnsRestaurant(req, restaurantId);

    const result = await evaluateSegment(restaurantId, rules);

    const segment = await prisma.segment.create({
      data: {
        restaurantId,
        name,
        description: description || null,
        rules,
        isAuto: isAuto || false,
        cachedCount: result.count,
        cachedAt: new Date(),
      },
    });

    return NextResponse.json({ segment, ...result });
  } catch (e: any) {
    if (e.status === 403) return authErrorResponse(e);
    console.error("Segment create error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
