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

  // ═══ STEP fix-logo: Crop Pavito logo ═══
  if (step === "fix-logo") {
    const sharp = (await import("sharp")).default;
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const res = await fetch("https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/logos/1780133047284-ht76n4b1848.jpg");
    const buffer = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    const w = meta.width!, h = meta.height!;

    const cropped = await sharp(buffer)
      .extract({ left: Math.round(w * 0.15), top: Math.round(h * 0.35), width: Math.round(w * 0.7), height: Math.round(h * 0.3) })
      .resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .jpeg({ quality: 90 })
      .toBuffer();

    const fileName = `logos/pavito-logo-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("fotos").upload(fileName, cropped, { contentType: "image/jpeg", upsert: true });
    if (error) return NextResponse.json({ ok: false, error: error.message });

    const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);
    await prisma.restaurant.update({
      where: { slug: "la-picada-del-pa-vito" },
      data: { logoUrl: urlData.publicUrl },
    });

    return NextResponse.json({ ok: true, step: "fix-logo", newUrl: urlData.publicUrl });
  }

  // ═══ STEP email-terraza: Send photo update email to Terraza Alameda ═══
  if (step === "email-terraza") {
    const { sendAdminEmail } = await import("@/lib/email/sendAdminEmail");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
  <tr><td align="center" style="padding-bottom:24px;">
    <a href="${baseUrl}" style="text-decoration:none;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:3px;"><img src="${baseUrl}/landing/logo.png" alt="" width="26" height="20" style="width:26px;height:20px;display:block;" /></td>
      <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:#E8A33D;">QuieroComer</span></td>
    </tr></table></a>
  </td></tr>
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">📸</span></td></tr>
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.2;">Actualizamos las fotos de tu carta</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Victor, detectamos que las fotos de la carta de <strong style="color:#E8A33D;">Terraza Alameda</strong> no eran las correctas — se estaban mostrando imágenes genéricas en lugar de las fotos reales de tus platos.
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Ya lo corregimos. Extrajimos las fotos directamente desde tu sitio web y las actualizamos en tu carta digital. Ahora tus clientes ven <strong>tus platos reales</strong>.
  </td></tr>
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid rgba(232,163,61,0.2);border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:10px;color:#E8A33D;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Lo que hicimos</div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:5px 0;font-size:14px;color:#6c4d22;line-height:1.5;"><span style="color:#16a34a;margin-right:6px;">✓</span> 73 platos ahora tienen sus fotos reales</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#6c4d22;line-height:1.5;"><span style="color:#16a34a;margin-right:6px;">✓</span> Se eliminaron todas las imágenes genéricas</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#6c4d22;line-height:1.5;"><span style="color:#16a34a;margin-right:6px;">✓</span> Tu vista por defecto ahora es Impact</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:14px;color:#8a7550;line-height:1.5;padding-bottom:16px;text-align:center;">
    Disculpa las molestias. Si necesitas ajustar algo, puedes hacerlo desde tu panel.
  </td></tr>
  <tr><td style="padding-bottom:8px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0;">
      <a href="${baseUrl}/qr/terraza-alameda" style="display:inline-block;background:#E8A33D;color:#fff;font-size:15px;font-weight:800;padding:14px 32px;border-radius:14px;text-decoration:none;">Ver mi carta →</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding-bottom:4px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0;">
      <a href="${baseUrl}/panel" style="display:inline-block;background:#fffaf1;color:#6c4d22;border:1px solid #e8dcc4;font-size:15px;font-weight:800;padding:14px 32px;border-radius:14px;text-decoration:none;">Ir a mi panel</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding-top:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td><a href="${baseUrl}" style="font-family:Georgia,serif;font-size:13px;color:#E8A33D;text-decoration:none;">QuieroComer.cl</a></td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">Hecho en Chile</td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">&copy; ${new Date().getFullYear()}</td>
    </tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    await sendAdminEmail({
      to: "terrazaalamedalinares@gmail.com",
      subject: "Victor, actualizamos las fotos de tu carta",
      html,
      purpose: "photo_update",
    });

    return NextResponse.json({ ok: true, step: "email-terraza", to: "terrazaalamedalinares@gmail.com" });
  }

  // ═══ STEP email-plan: Send plan activation email ═══
  if (step === "email-plan") {
    if (!restaurant.owner?.email) return NextResponse.json({ error: "No owner email" }, { status: 400 });
    const { sendAdminEmail, planActivatedEmailHtml } = await import("@/lib/email/sendAdminEmail");
    const { grossOf } = await import("@/lib/billing/plans-config");
    const { PLANS } = await import("@/lib/billing/plans-central");
    const firstName = (restaurant.owner.name || "").split(" ")[0] || "Hola";
    const planKey = restaurant.plan as keyof typeof PLANS;
    const planLabel = restaurant.plan === "PREMIUM" ? "Premium" : restaurant.plan === "GOLD" ? "Gold" : "Silver";
    const net = PLANS[planKey]?.priceMonthly || 0;
    const gross = grossOf(net);
    const fmtPrice = (n: number) => `$${n.toLocaleString("es-CL")}`;
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

    await sendAdminEmail({
      to: restaurant.owner.email,
      subject: `¡Tu plan ${planLabel} en ${restaurant.name} está activo!`,
      html: planActivatedEmailHtml(firstName, restaurant.name, planLabel, fmtPrice(gross), nextDate, fmtPrice(gross), `${baseUrl}/panel`, `${baseUrl}/qr/${restaurant.slug}`),
      purpose: "plan_activated",
    });

    return NextResponse.json({ ok: true, step: "email-plan", to: restaurant.owner.email, plan: planLabel });
  }

  // ═══ STEP fix-mp: Find and link MP subscription ═══
  if (step === "fix-mp") {
    try {
      const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
      const config = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });
      const client = new PreApproval(config);

      const result = await client.search({
        options: { external_reference: restaurant.id },
      });

      const subs = (result.results || []).map((s: any) => ({
        id: s.id, status: s.status, reason: s.reason,
        payer_email: s.payer_email, next_payment_date: s.next_payment_date,
      }));

      // Auto-link the first authorized/pending subscription
      const active = (result.results || []).find((s: any) => ["authorized", "pending"].includes(s.status));
      if (active?.id) {
        await prisma.restaurant.update({
          where: { slug: SLUG },
          data: { mpSubscriptionId: active.id },
        });
        return NextResponse.json({ ok: true, step: "fix-mp", linked: active.id, allSubs: subs });
      }

      return NextResponse.json({ ok: false, step: "fix-mp", message: "No active subscription found", allSubs: subs });
    } catch (e: any) {
      return NextResponse.json({ ok: false, step: "fix-mp", error: e.message });
    }
  }

  return NextResponse.json({
    error: "Use ?step=6, ?step=7, ?step=reset, or ?step=fix-mp",
    currentState: {
      plan: restaurant.plan,
      subscriptionStatus: restaurant.subscriptionStatus,
      trialEndsAt: restaurant.trialEndsAt,
      trialReminderSentAt: restaurant.trialReminderSentAt,
      mpSubscriptionId: (restaurant as any).mpSubscriptionId,
    },
  });
}
