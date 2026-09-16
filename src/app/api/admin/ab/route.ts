import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const rows = await prisma.$queryRaw<{ variant: string; eventType: string; count: bigint }[]>`
      SELECT variant, "eventType", COUNT(*) as count
      FROM "AbEvent"
      GROUP BY variant, "eventType"
      ORDER BY variant, "eventType"
    `;

    // Normalize bigint → number
    const data = rows.map(r => ({ variant: r.variant, eventType: r.eventType, count: Number(r.count) }));
    return NextResponse.json(data);
  } catch (e) {
    console.error("[admin/ab]", e);
    return NextResponse.json([], { status: 500 });
  }
}
