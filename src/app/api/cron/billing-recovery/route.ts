import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowGet } from "@/lib/billing/flow";
import { planFromFlowId, grossOf, FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * Cron — billing-recovery
 *
 * Detecta locales con suscripción Flow cuyo período ha vencido o está por vencer
 * en las próximas 24h, consulta Flow para verificar si la suscripción sigue activa,
 * y extiende el período automáticamente si Flow confirma que está vigente.
 *
 * Esto cubre el caso de planes legacy (qc_premium_monthly) que Flow puede seguir
 * cobrando aunque el plan ya no exista con ese ID en nuestra configuración.
 *
 * Corre 2 veces al día: 09:00 y 21:00 UTC.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const start = Date.now();

  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Ventana: período vencido hasta 24h en el futuro (próximos a vencer)
  const cutoffFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // No recuperar períodos que vencieron hace más de 7 días (evitar casos extremos)
  const cutoffPast = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const results: { name: string; action: string; detail?: string }[] = [];

  try {
    // Locales con suscripción Flow activa cuyo período está por vencer o ya venció
    const candidates = await prisma.restaurant.findMany({
      where: {
        flowSubscriptionId: { not: null },
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { gte: cutoffPast, lte: cutoffFuture },
        plan: { not: "FREE" },
        billingExempt: false,
      },
      select: {
        id: true, name: true, plan: true,
        flowSubscriptionId: true, flowPlanId: true,
        currentPeriodEnd: true, lastPaymentAt: true,
      },
    });

    for (const r of candidates) {
      if (!r.flowSubscriptionId) continue;

      try {
        // Consultar estado de la suscripción en Flow
        const sub = await flowGet<any>("/subscription/get", {
          subscriptionId: r.flowSubscriptionId,
        });

        // sub.status: 1=active, 2=suspended, 3=cancelled
        if (sub.status !== 1) {
          results.push({ name: r.name, action: "skipped", detail: `Flow status=${sub.status}` });
          continue;
        }

        // Suscripción activa en Flow — verificar si necesita extensión
        const periodEnd = r.currentPeriodEnd ? new Date(r.currentPeriodEnd) : null;
        const hoursUntilExpiry = periodEnd ? (periodEnd.getTime() - now.getTime()) / 3600000 : -1;

        // Solo extender si el período vence en menos de 4h o ya venció
        if (hoursUntilExpiry > 4) {
          results.push({ name: r.name, action: "ok", detail: `expires in ${Math.round(hoursUntilExpiry)}h` });
          continue;
        }

        // Determinar plan desde flowPlanId
        const appPlan = planFromFlowId(r.flowPlanId || "") || r.plan;
        const amountNet = FLOW_PLANS[appPlan]?.amountNet ?? FLOW_PLANS.PREMIUM.amountNet;

        // Extender desde el vencimiento actual (o desde ahora si ya venció)
        const baseDate = periodEnd && periodEnd > now ? periodEnd : now;
        const newEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.restaurant.update({
          where: { id: r.id },
          data: {
            subscriptionStatus: "ACTIVE",
            isActive: true,
            currentPeriodEnd: newEnd,
            lastPaymentAt: now,
          },
        });

        await prisma.panelActivity.create({
          data: {
            restaurantId: r.id,
            action: "payment_received",
            details: {
              plan: appPlan,
              amountNet,
              amountGross: grossOf(amountNet),
              periodEnd: newEnd.toISOString(),
              source: "billing_recovery_cron",
            } as any,
          },
        }).catch(() => {});

        results.push({ name: r.name, action: "extended", detail: `until ${newEnd.toLocaleDateString("es-CL")}` });
      } catch (err: any) {
        const msg = err?.message || "unknown";
        results.push({ name: r.name, action: "error", detail: msg });
        console.error(`[billing-recovery] Error checking ${r.name}:`, err);
      }
    }

    const durationMs = Date.now() - start;
    await prisma.cronLog.create({
      data: {
        jobName: "billing-recovery",
        status: "success",
        durationMs,
        details: { checked: candidates.length, results } as any,
      },
    });

    return NextResponse.json({ ok: true, checked: candidates.length, results, durationMs });
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await prisma.cronLog.create({
      data: { jobName: "billing-recovery", status: "error", durationMs, error: errorMsg },
    }).catch(() => {});
    console.error("[billing-recovery] fatal error:", error);
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
