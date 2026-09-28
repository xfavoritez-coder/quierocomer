import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";

/**
 * POST /api/admin/migrate-flow-plans
 *
 * Migra las suscripciones Flow de `qc_premium_monthly` (plan legacy) a `qc_monthly`
 * (plan actual) sin que el cliente deba hacer nada.
 *
 * Usar UNA vez para los clientes existentes afectados.
 * Header requerido: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurants = await prisma.restaurant.findMany({
    where: {
      flowPlanId: "qc_premium_monthly",
      flowSubscriptionId: { not: null },
      subscriptionStatus: "ACTIVE",
    },
    select: { id: true, name: true, flowSubscriptionId: true },
  });

  const results: { name: string; subscriptionId: string; status: string; detail?: string }[] = [];

  for (const r of restaurants) {
    if (!r.flowSubscriptionId) continue;
    try {
      // Flow API: modificar plan de la suscripción
      const res = await flowPost<any>("/subscription/modify", {
        subscriptionId: r.flowSubscriptionId,
        planId: "qc_monthly",
      });

      // Actualizar el planId en nuestra DB
      await prisma.restaurant.update({
        where: { id: r.id },
        data: { flowPlanId: "qc_monthly" },
      });

      results.push({ name: r.name, subscriptionId: r.flowSubscriptionId, status: "migrated", detail: JSON.stringify(res).slice(0, 200) });
      console.log(`[migrate-flow-plans] ✅ ${r.name} → qc_monthly`);
    } catch (err: any) {
      const detail = err?.message || "unknown";
      results.push({ name: r.name, subscriptionId: r.flowSubscriptionId, status: "error", detail });
      console.error(`[migrate-flow-plans] ❌ ${r.name}:`, err);
    }
  }

  return NextResponse.json({ ok: true, count: restaurants.length, results });
}
