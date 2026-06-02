import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Temporal test endpoint for funnel steps.
 * Usage:
 *   /api/test-funnel?step=6  → trial reminder email (sets trial to expire tomorrow)
 *   /api/test-funnel?step=7  → expire trial + downgrade + email + WA
 *   /api/test-funnel?step=reset → reset back to TRIALING for re-testing
 *
 * DELETE THIS FILE AFTER TESTING
 */
export const maxDuration = 60;

const SLUG = "fogon-del-puerto";
const SECRET = "jaime2026"; // simple guard

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const step = searchParams.get("step");
  const key = searchParams.get("key");

  if (key !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: SLUG },
    select: {
      id: true, name: true, slug: true, plan: true,
      subscriptionStatus: true, trialEndsAt: true, trialReminderSentAt: true,
      owner: { select: { email: true, name: true } },
    },
  });

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  // ═══ STEP 6: Trial reminder email ═══
  if (step === "6") {
    // Set trial to expire tomorrow
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    await prisma.restaurant.update({
      where: { slug: SLUG },
      data: { trialEndsAt: tomorrow, trialReminderSentAt: null, subscriptionStatus: "TRIALING", plan: "PREMIUM" },
    });

    if (!restaurant.owner?.email) return NextResponse.json({ error: "No owner email" }, { status: 400 });

    const { sendAdminEmail, trialEndingSoonEmailHtml } = await import("@/lib/email/sendAdminEmail");
    const firstName = (restaurant.owner.name || "").split(" ")[0] || "Hola";

    await sendAdminEmail({
      to: restaurant.owner.email,
      subject: `🎁 Tu regalo termina mañana`,
      html: trialEndingSoonEmailHtml(firstName, restaurant.name, 1, `${baseUrl}/panel`, `${baseUrl}/panel/suscripcion`),
      purpose: "trial_reminder",
    });

    await prisma.restaurant.update({
      where: { slug: SLUG },
      data: { trialReminderSentAt: now },
    });

    return NextResponse.json({ ok: true, step: 6, action: "trial_reminder_sent", to: restaurant.owner.email });
  }

  // ═══ STEP 7: Expire trial → downgrade to FREE + email + WA ═══
  if (step === "7") {
    // Force expire
    await prisma.restaurant.update({
      where: { slug: SLUG },
      data: { subscriptionStatus: "NONE", plan: "FREE", trialEndsAt: null },
    });

    const results: string[] = ["downgraded to FREE"];

    // Email
    if (restaurant.owner?.email) {
      try {
        const { sendAdminEmail, trialExpiredEmailHtml } = await import("@/lib/email/sendAdminEmail");
        const firstName = (restaurant.owner.name || "").split(" ")[0] || "Hola";
        await sendAdminEmail({
          to: restaurant.owner.email,
          subject: `Tu carta QR volvió al plan gratis`,
          html: trialExpiredEmailHtml(firstName, restaurant.name, `${baseUrl}/panel/suscripcion`),
          purpose: "trial_expired",
        });
        results.push("email sent");
      } catch (e: any) {
        results.push(`email error: ${e.message}`);
      }
    }

    // WhatsApp
    try {
      const lead = await prisma.lead.findFirst({
        where: { generatedSlug: SLUG },
        select: { id: true, whatsapp: true, ownerName: true, events: true },
      });
      if (lead?.whatsapp) {
        const { sendWhatsApp } = await import("@/lib/whatsapp");
        const ownerName = (lead.ownerName || restaurant.owner?.name || "Hola").split(" ")[0];
        const sid = await sendWhatsApp({
          to: lead.whatsapp,
          body: "",
          contentSid: "HX553107603c0366a63214d4f52afc8e38",
          contentVariables: { "1": ownerName, "2": restaurant.name },
        });
        if (sid) {
          const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
          events.push({ ts: now.toISOString(), action: "nurturing_trial_usado", sid });
          await prisma.lead.update({ where: { id: lead.id }, data: { events: events as any } });
          results.push(`whatsapp sent (sid: ${sid})`);
        }
      } else {
        results.push("no whatsapp on lead");
      }
    } catch (e: any) {
      results.push(`whatsapp error: ${e.message}`);
    }

    return NextResponse.json({ ok: true, step: 7, actions: results });
  }

  // ═══ RESET: Back to TRIALING for re-testing ═══
  if (step === "reset") {
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await prisma.restaurant.update({
      where: { slug: SLUG },
      data: {
        subscriptionStatus: "TRIALING", plan: "PREMIUM",
        trialEndsAt: trialEnd, trialReminderSentAt: null,
      },
    });

    // Clear nurturing events from lead
    const lead = await prisma.lead.findFirst({ where: { generatedSlug: SLUG } });
    if (lead) {
      const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
      const cleaned = events.filter((e: any) => e.action !== "nurturing_trial_usado");
      await prisma.lead.update({ where: { id: lead.id }, data: { events: cleaned as any } });
    }

    return NextResponse.json({ ok: true, step: "reset", trialEndsAt: trialEnd.toISOString() });
  }

  return NextResponse.json({
    error: "Use ?step=6, ?step=7, or ?step=reset",
    currentState: {
      plan: restaurant.plan,
      subscriptionStatus: restaurant.subscriptionStatus,
      trialEndsAt: restaurant.trialEndsAt,
      trialReminderSentAt: restaurant.trialReminderSentAt,
    },
  });
}
