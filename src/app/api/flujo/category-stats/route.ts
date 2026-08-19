import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

export async function GET() {
  const stats = await prisma.$queryRaw<{ categoryId: string; uses: bigint }[]>`
    SELECT "categoryId", COUNT(*) as uses
    FROM "FinancialEntry"
    WHERE "restaurantId" = ${HORUS_ID}
      AND source = 'FLUJO'
    GROUP BY "categoryId"
    ORDER BY uses DESC
  `;
  return NextResponse.json(
    stats.map(s => ({ categoryId: s.categoryId, uses: Number(s.uses) }))
  );
}
