import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFintocMovements } from "@/app/api/admin/financial/fintoc/route";

// Cron diario: sincroniza movimientos de todos los restaurantes conectados a Fintoc
// Configurar en vercel.json: "0 7 * * *" (7am UTC = 4am Chile)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { fintocLinkToken: { not: null } },
    select: { id: true, fintocLinkToken: true, fintocAccountId: true, fintocLastSync: true },
  });

  const results: { restaurantId: string; ok: boolean; created?: number; error?: string }[] = [];

  for (const r of restaurants) {
    try {
      const res = await syncFintocMovements(
        r.id,
        r.fintocLinkToken!,
        r.fintocAccountId,
        r.fintocLastSync
      );
      results.push({ restaurantId: r.id, ok: true, created: res.created });
    } catch (e: any) {
      results.push({ restaurantId: r.id, ok: false, error: e.message });
    }
  }

  return NextResponse.json({ synced: restaurants.length, results });
}
