import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { evaluateSegment } from "@/lib/segments/evaluator";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const segments = await prisma.segment.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ segments });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_token")?.value) return NextResponse.json({ error: "Not auth" }, { status: 401 });

  try {
    const { restaurantId, name, description, rules, isAuto } = await req.json();
    if (!restaurantId || !name || !rules) {
      return NextResponse.json({ error: "restaurantId, name, rules required" }, { status: 400 });
    }

    // Evaluate count
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
  } catch (error) {
    console.error("Segment create error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
