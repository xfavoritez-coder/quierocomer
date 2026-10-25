import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowGet } from "@/lib/billing/flow";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
const SEED_SECRET = process.env.SEED_SECRET;

/**
 * POST /api/admin/recover-flow-customer-ids
 * Authorization: Bearer <ADMIN_SECRET|CRON_SECRET>  OR  ?key=<SEED_SECRET>
 *
 * Para cada restaurante con lastPaymentAt pero sin flowCustomerId,
 * busca en Flow si existe un cliente con ese externalId y lo guarda en BD.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const keyParam = req.nextUrl.searchParams.get("key");
  const validBearer = ADMIN_SECRET && auth === `Bearer ${ADMIN_SECRET}`;
  const validKey = SEED_SECRET && keyParam === SEED_SECRET;
  if (!validBearer && !validKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { flowCustomerId: null, isDemo: false, lastPaymentAt: { not: null } },
    select: {
      id: true, name: true, slug: true,
      owner: { select: { email: true } },
    },
    orderBy: { name: "asc" },
  });

  const results: { name: string; action: string; customerId?: string }[] = [];

  for (const r of restaurants) {
    const email = r.owner?.email;
    if (!email) {
      results.push({ name: r.name, action: "skip_no_email" });
      continue;
    }

    try {
      const list = await flowGet<{ data: { customerId: string; externalId: string }[] }>(
        "/customer/getList",
        { filter: email, start: 0, limit: 50 }
      );

      const match = list.data?.find((c) => c.externalId === r.id);
      if (match) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { flowCustomerId: match.customerId },
        });
        results.push({ name: r.name, action: "recovered", customerId: match.customerId });
      } else {
        results.push({ name: r.name, action: "not_in_flow" });
      }
    } catch (err: any) {
      results.push({ name: r.name, action: "error", customerId: err?.message });
    }
  }

  const recovered = results.filter(r => r.action === "recovered").length;
  const notInFlow = results.filter(r => r.action === "not_in_flow").length;
  const errors = results.filter(r => r.action === "error").length;

  return NextResponse.json({ ok: true, total: restaurants.length, recovered, notInFlow, errors, results });
}
