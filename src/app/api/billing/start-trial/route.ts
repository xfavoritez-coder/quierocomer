import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRIAL_DAYS } from "@/lib/billing/plans-central";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";

/**
 * Activates a 7-day Premium trial directly — no payment required.
 * Available to all FREE plan restaurants, even if they've trialed before.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  // Block if already on an active paid plan
  if (restaurant.plan === "PREMIUM" && restaurant.subscriptionStatus === "ACTIVE") {
    return NextResponse.json({ error: "Ya tienes Premium activo" }, { status: 409 });
  }
  // Block if currently in a trial
  if (restaurant.subscriptionStatus === "TRIALING") {
    return NextResponse.json({ error: "Ya tienes un periodo de prueba activo" }, { status: 409 });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan: "PREMIUM",
      subscriptionStatus: "TRIALING",
      trialEndsAt,
      isDemo: false,
    },
  });

  // Email simple: tu prueba comenzó (sin credenciales ni WhatsApp)
  const trialEndLabel = trialEndsAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" });
  sendAdminEmail({
    to: owner.email,
    subject: `🎉 Tu prueba Premium de ${restaurant.name} ya comenzó`,
    html: trialStartedEmailHtml({ ownerName: owner.name, restaurantName: restaurant.name, trialEndLabel }),
    purpose: "trial_started_from_panel",
  }).catch((err) => console.error("[start-trial] email error:", err));

  return NextResponse.json({ ok: true, plan: "PREMIUM", trialEndsAt: trialEndsAt.toISOString() });
}

function trialStartedEmailHtml({ ownerName, restaurantName, trialEndLabel }: { ownerName: string; restaurantName: string; trialEndLabel: string }): string {
  const firstName = ownerName.split(" ")[0];
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  return `<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:16px">
  <a href="${BASE_URL}" style="text-decoration:none;"><table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td style="vertical-align:middle;padding-right:3px;"><img src="https://quierocomer.cl/logo.png" alt="" width="24" height="24" style="display:block;" /></td>
    <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:#e8930a;">QuieroComer</span></td>
  </tr></table></a>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 24px 70px rgba(70,45,10,0.10)">
<tr><td style="padding:32px 24px 28px">
  <div style="text-align:center;font-size:40px;margin-bottom:16px">🎉</div>
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;letter-spacing:-0.02em;margin:0 0 16px;color:#111111;text-align:center">
    ${firstName}, tu prueba de 7 días<br/>ya está activa
  </h1>
  <p style="font-size:15px;color:#7a6547;line-height:1.6;margin:0 0 20px;text-align:center">
    <strong style="color:#111">${restaurantName}</strong> tiene acceso completo a todas las funciones Premium hasta el <strong style="color:#111">${trialEndLabel}</strong>.
  </p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td style="text-align:center">
    <a href="${BASE_URL}/panel" style="display:inline-block;background:#f7a400;color:#ffffff;font-size:15px;font-weight:800;padding:16px 32px;border-radius:14px;text-decoration:none;box-shadow:0 10px 22px rgba(242,154,0,0.28)">
      Ir a mi panel →
    </a>
  </td></tr>
  </table>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:20px">
  <p style="color:#b8a888;font-size:11px;margin:0">QuieroComer.cl · ${new Date().getFullYear()} · Hecho en Chile</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
