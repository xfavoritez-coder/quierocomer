import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowGet } from "@/lib/billing/flow";
import { planFromFlowId } from "@/lib/billing/plans-config";

/**
 * Cron — billing-recovery  (09:00 y 21:00 UTC)
 *
 * Para cada local con suscripción Flow cuyo período esté vencido o a punto de vencer:
 *  1. Consulta Flow — si la suscripción sigue ACTIVA (status=1), el cobro ocurrió
 *     pero el webhook no llegó (o llegó y falló). Extendemos el período en nuestra DB
 *     para que la carta no se interrumpa.
 *  2. Si la suscripción está SUSPENDIDA o CANCELADA en Flow, no extendemos y alertamos.
 *
 * IMPORTANTE: este cron solo mantiene el período en la DB sincronizado con Flow.
 * NO simula pagos: no actualiza lastPaymentAt (eso solo lo hace el webhook cuando
 * llega el cobro real de Flow). No registra payment_received.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const start = Date.now();

  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Buscar locales cuyo período vence en las próximas 12h o ya venció (hasta 10 días atrás)
  // 12h adelante: suficiente para detectar antes de que expire con la siguiente ejecución
  // 10 días atrás: cubre casos donde el webhook falló repetidamente
  const windowFuture = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const windowPast = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const results: { name: string; action: string; detail?: string }[] = [];

  try {
    const candidates = await prisma.restaurant.findMany({
      where: {
        flowSubscriptionId: { not: null },
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { gte: windowPast, lte: windowFuture },
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
        const sub = await flowGet<any>("/subscription/get", {
          subscriptionId: r.flowSubscriptionId,
        });

        // sub.status: 1=active, 2=suspended, 3=cancelled
        if (sub.status !== 1) {
          // Suscripción caída en Flow — alertar pero no extender
          results.push({ name: r.name, action: "flow_inactive", detail: `Flow status=${sub.status}` });
          console.warn(`[billing-recovery] ⚠️ Suscripción inactiva en Flow: ${r.name} (status=${sub.status})`);
          continue;
        }

        // morose=1 significa que Flow tiene una invoice impaga y está reintentando cobrar.
        // En ese caso NO extendemos — Flow se encarga de reintentar y cuando pase el cobro
        // llegará el webhook. Extender aquí sería dar servicio sin pago.
        if (sub.morose === 1) {
          results.push({ name: r.name, action: "morose_skip", detail: `Flow reintentando cobro, invoices pendientes` });
          console.log(`[billing-recovery] ⏳ ${r.name}: morose=1, Flow reintentando — no extender`);
          continue;
        }

        const periodEnd = r.currentPeriodEnd ? new Date(r.currentPeriodEnd) : null;
        const hoursUntilExpiry = periodEnd ? (periodEnd.getTime() - now.getTime()) / 3600000 : -1;

        // Solo actuar si el período ya venció o vence en menos de 6h
        if (hoursUntilExpiry > 6) {
          results.push({ name: r.name, action: "ok", detail: `expires in ${Math.round(hoursUntilExpiry)}h` });
          continue;
        }

        // Flow confirma suscripción activa pero el webhook no actualizó nuestro período.
        // Extender el período sin tocar lastPaymentAt (el webhook real lo actualizará cuando llegue).
        const baseDate = periodEnd && periodEnd > now ? periodEnd : now;
        const newEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const appPlan = planFromFlowId(r.flowPlanId || "") || r.plan;

        await prisma.restaurant.update({
          where: { id: r.id },
          data: {
            subscriptionStatus: "ACTIVE",
            isActive: true,
            currentPeriodEnd: newEnd,
            // NO actualizamos lastPaymentAt — eso solo lo hace el webhook con el cobro real
          },
        });

        // Registrar como evento de recuperación, no como pago
        await prisma.panelActivity.create({
          data: {
            restaurantId: r.id,
            action: "period_extended_recovery",
            details: {
              plan: appPlan,
              newPeriodEnd: newEnd.toISOString(),
              reason: "flow_webhook_missing",
              flowStatus: sub.status,
              previousEnd: periodEnd?.toISOString(),
            } as any,
          },
        }).catch(() => {});

        results.push({ name: r.name, action: "extended", detail: `until ${newEnd.toLocaleDateString("es-CL")}` });
        console.log(`[billing-recovery] ✅ Período extendido: ${r.name} → ${newEnd.toLocaleDateString("es-CL")}`);
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
