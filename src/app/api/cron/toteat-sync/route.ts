import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRestaurantSales } from "@/lib/toteat/sync";

/**
 * Periodic sync of Toteat sales for every restaurant configured with
 * Toteat credentials. Runs every 30 min (cron) or on demand from /api/admin.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` header. Vercel cron
 * sends this automatically when configured in vercel.json.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurants = await prisma.restaurant.findMany({
    where: {
      toteatApiToken: { not: null },
      toteatRestaurantId: { not: null },
      toteatLocalId: { not: null },
      toteatUserId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      toteatRestaurantId: true,
      toteatLocalId: true,
      toteatUserId: true,
      toteatApiToken: true,
      toteatLastSyncAt: true,
    },
  });

  const results = [];
  for (const r of restaurants) {
    const last = r.toteatLastSyncAt;
    let fromDate = last
      ? new Date(Math.max(last.getTime() - 5 * 60_000, Date.now() - 24 * 60 * 60 * 1000)) // 5min overlap, max 24h back
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Never go before the first QC session of the local — pre-QC Toteat sales
    // can't be cross-referenced with carta data and pollute analytics.
    const firstSession = await prisma.session.findFirst({
      where: { restaurantId: r.id },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    });
    if (firstSession && firstSession.startedAt > fromDate) fromDate = firstSession.startedAt;

    const result = await syncRestaurantSales({
      restaurantId: r.id,
      credentials: {
        base: process.env.TOTEAT_API_BASE || "https://api.toteat.com/mw/or/1.0",
        xir: r.toteatRestaurantId!,
        xil: r.toteatLocalId!,
        xiu: r.toteatUserId!,
        token: r.toteatApiToken!,
      },
      from: fromDate,
      to: new Date(),
    });
    results.push({ slug: r.slug, ...result });
  }

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), restaurants: results });
}
