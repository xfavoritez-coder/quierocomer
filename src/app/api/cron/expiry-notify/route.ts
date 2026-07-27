import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron — runs at 20:00 UTC = 16:00 Chile (UTC-4 winter)
 *
 * Sends email + WhatsApp "vence hoy" to owners whose plan expires today in Chile timezone.
 * Uses Chile date comparison to avoid UTC/timezone drift.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const start = Date.now();

  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const chileDate = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
    const todayChile = chileDate(now);

    // Query a 36h window (±18h around now) and filter by Chile date in-memory
    // to correctly handle the UTC-3/UTC-4 offset regardless of DST.
    const windowStart = new Date(now.getTime() - 18 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 18 * 60 * 60 * 1000);

    const candidates = await prisma.restaurant.findMany({
      where: {
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { gte: windowStart, lte: windowEnd },
        billingExempt: false,
        mpSubscriptionId: null,
        plan: { not: "FREE" },
      },
      select: {
        id: true, name: true, plan: true, currentPeriodEnd: true,
        owner: { select: { id: true, email: true, name: true, whatsapp: true } },
      },
    });

    // Filter to only plans that expire today in Chile timezone
    const expiringToday = candidates.filter(
      r => r.currentPeriodEnd && chileDate(new Date(r.currentPeriodEnd)) === todayChile
    );

    let emailsSent = 0;
    let waSent = 0;

    if (expiringToday.length > 0) {
      const { sendAdminEmail, planExpiryTodayEmailHtml } = await import("@/lib/email/sendAdminEmail");
      const { buildAutoLoginUrl } = await import("@/lib/email/autoLoginUrl");
      const { PLAN_LABELS } = await import("@/lib/billing/plans-config");
      const { sendWhatsApp, BILLING_EXPIRY_TODAY_WA_TEMPLATE } = await import("@/lib/whatsapp");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
      const expiryDate = now.toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long" });

      // Helper: detect payment method
      const manualLogs = await prisma.panelActivity.findMany({
        where: { restaurantId: { in: expiringToday.map(r => r.id) }, action: "manual_payment" },
        select: { restaurantId: true },
        distinct: ["restaurantId"],
      });
      const hasManual = new Set(manualLogs.map((l: any) => l.restaurantId));

      // Dedupe window: start of today Chile in UTC
      const startOfTodayChile = new Date(`${todayChile}T00:00:00`);
      startOfTodayChile.setTime(startOfTodayChile.getTime() + (new Date().getTimezoneOffset() * 60000));

      for (const r of expiringToday) {
        if (!r.owner?.email) continue;

        const planLabel = PLAN_LABELS[r.plan as "GOLD" | "SILVER" | "PREMIUM"] || r.plan;
        const panelLink = buildAutoLoginUrl(baseUrl, r.owner.id) +
          `&redirect=/panel/mi-restaurante%3Frenew%3D1%26plan%3D${r.plan}`;
        const paymentMethod = hasManual.has(r.id) ? "transfer" : "online";

        // Email (dedupe by purpose + today window)
        const alreadySentEmail = await prisma.emailLog.findFirst({
          where: { to: r.owner.email, purpose: "expiry_today", createdAt: { gte: windowStart } },
        });
        if (!alreadySentEmail) {
          try {
            await sendAdminEmail({
              to: r.owner.email,
              subject: `${r.name} · Tu plan ${planLabel} vence hoy, ${expiryDate}`,
              html: planExpiryTodayEmailHtml({ restaurantName: r.name, planLabel, expiryDate, panelLink, paymentMethod }),
              purpose: "expiry_today",
            });
            emailsSent++;
          } catch (e) { console.error("[expiry-notify] email error:", e); }
        }

        // WhatsApp
        if (r.owner.whatsapp) {
          try {
            const alreadySentWa = await prisma.panelActivity.findFirst({
              where: { restaurantId: r.id, action: "wa_expiry_today", createdAt: { gte: windowStart } },
            });
            if (!alreadySentWa) {
              const ownerName = (r.owner.name || "").split(" ")[0] || "Hola";
              const sid = await sendWhatsApp({
                to: r.owner.whatsapp,
                body: "",
                contentSid: BILLING_EXPIRY_TODAY_WA_TEMPLATE,
                contentVariables: { "1": ownerName, "2": r.name, "3": panelLink },
              });
              if (sid) {
                await prisma.panelActivity.create({
                  data: { restaurantId: r.id, action: "wa_expiry_today", details: { sid } as any },
                });
                waSent++;
              }
            }
          } catch (e) { console.error("[expiry-notify] WA error:", e); }
        }
      }
    }

    const durationMs = Date.now() - start;
    await prisma.cronLog.create({
      data: {
        jobName: "expiry-notify",
        status: "success",
        durationMs,
        details: { expiringToday: expiringToday.length, emailsSent, waSent },
      },
    });

    return NextResponse.json({ ok: true, todayChile, expiringToday: expiringToday.length, emailsSent, waSent, durationMs });
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await prisma.cronLog.create({
      data: { jobName: "expiry-notify", status: "error", durationMs, error: errorMsg },
    }).catch(() => {});
    console.error("[expiry-notify] error:", error);
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
