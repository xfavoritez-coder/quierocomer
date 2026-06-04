import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail, adminEmailTemplate, btn, resetPasswordEmailHtml, cartaListaSimpleEmailHtml, trialEndingSoonEmailHtml, trialExpiredEmailHtml } from "@/lib/email/sendAdminEmail";
import { activationWelcomeEmailHtml } from "@/app/api/preview-email/activation/route";
import { sendWhatsApp } from "@/lib/whatsapp";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

// WA Templates with exact approved texts
const WA_TEMPLATES: Record<string, { sid: string; vars: (name: string, restName?: string) => Record<string, string>; desc: string; text: (name: string, rest: string) => string }> = {
  carta_lista: { sid: "HX73cbf24831adf5448d0e4eef6cb84f41", vars: (name) => ({ "1": name }), desc: "Tu carta esta lista", text: (n) => `Tu carta esta lista, ${n}. Revísala en el link que te enviamos.` },
  carta_fallo: { sid: "HX0bdab227710250fd28be04263845fb99", vars: (name) => ({ "1": name }), desc: "No pudimos procesar tu carta", text: (n) => `${n}, no pudimos procesar tu carta. Por favor intenta subirla de nuevo.` },
  camila_carta_no_revisada: { sid: "HX212aca9223fecaf089df099969e19a25", vars: (name, rest) => ({ "1": name, "2": rest || "" }), desc: "Camila: carta no revisada", text: (n, r) => `Hola ${n}, soy Camila de QuieroComer 👋 Te escribo por la carta de ${r}, ya está lista pero vi que aún no la revisas. ¿Tienes alguna duda o algo en que te pueda ayudar?` },
  camila_no_volvio: { sid: "HXe8201d69e53b2c6c4c2af79470c34845", vars: (name, rest) => ({ "1": name, "2": rest || "" }), desc: "Camila: no volviste", text: (n, r) => `Hola ${n}, soy Camila de QuieroComer 👋 Te escribo por la carta de ${r}, vi que la activaste y está lista pero no la continuaste usando. ¿Habrá algo que no te gustó o tienes alguna duda? Cualquier cosa es bienvenida, nos encantaría saber.` },
  camila_trial_usado: { sid: "HX553107603c0366a63214d4f52afc8e38", vars: (name, rest) => ({ "1": name, "2": rest || "" }), desc: "Camila: trial termino", text: (n, r) => `Hola ${n}, soy Camila de QuieroComer 👋 Te escribo por la carta de ${r}, tu periodo de prueba Premium terminó. Si quieres seguir con todas las funciones, puedes elegir un plan desde tu panel. ¿Tienes alguna duda?` },
};

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { channel, template, restaurantId } = await req.json();
  if (!channel || !template || !restaurantId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true, plan: true, trialEndsAt: true, qrToken: true,
      owner: { select: { id: true, name: true, email: true, whatsapp: true, passwordHash: true } } },
  });
  if (!restaurant || !restaurant.owner) return NextResponse.json({ error: "Restaurante o owner no encontrado" }, { status: 404 });

  const owner = restaurant.owner;
  const firstName = owner.name.split(" ")[0];
  const qrLink = `${BASE_URL}/qr/${restaurant.slug}`;
  const panelLink = `${BASE_URL}/api/panel/demo-auth?slug=${restaurant.slug}`;

  if (channel === "email") {
    let html: string;
    let subject: string;
    let purpose: string;

    if (template === "bienvenida") {
      const password = `${restaurant.slug}2026`;
      html = activationWelcomeEmailHtml({ ownerName: firstName, restaurantName: restaurant.name, panelLink, qrLink, credentials: { email: owner.email, password }, planLabel: restaurant.plan });
      subject = `🔑 Datos de acceso a tu panel — ${restaurant.name}`;
      purpose = "activation_welcome";
    } else if (template === "carta_lista") {
      html = cartaListaSimpleEmailHtml({ ownerName: firstName, restaurantName: restaurant.name, cartaUrl: qrLink, openPixel: "", dishCount: 0, categoryCount: 0 });
      subject = `${firstName}, tu carta de ${restaurant.name} está lista`;
      purpose = "funnel_carta_lista";
    } else if (template === "trial_por_vencer") {
      const daysLeft = restaurant.trialEndsAt ? Math.max(0, Math.ceil((restaurant.trialEndsAt.getTime() - Date.now()) / 86400000)) : 3;
      html = trialEndingSoonEmailHtml(firstName, restaurant.name, daysLeft, panelLink, `${BASE_URL}/panel/suscripcion`);
      subject = `${firstName}, te quedan ${daysLeft} dias de prueba`;
      purpose = "trial_ending";
    } else if (template === "trial_vencido") {
      html = trialExpiredEmailHtml(firstName, restaurant.name, `${BASE_URL}/panel/suscripcion`);
      subject = `${firstName}, tu prueba Premium termino`;
      purpose = "trial_expired";
    } else if (template === "confirmar_whatsapp") {
      html = adminEmailTemplate(`
        <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0 0 12px;text-align:center;line-height:1.2;">
          ${firstName}, necesitamos confirmar tu WhatsApp
        </h1>
        <p style="font-size:15px;color:#7a6547;line-height:1.6;text-align:center;margin:0 0 20px;">
          El número de WhatsApp de <strong style="color:#e8930a;">${restaurant.name}</strong> que tenemos registrado parece estar incompleto. Para que todo funcione correctamente, necesitamos tu número correcto.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid rgba(232,147,10,.2);border-radius:14px;margin-bottom:20px;">
          <tr><td style="padding:16px 18px;text-align:center;">
            <p style="font-size:12px;color:#e8930a;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">¿Cómo actualizar tu WhatsApp?</p>
            <p style="font-size:14px;color:#7a6547;line-height:1.5;margin:0;">
              Entra a tu panel → <strong>Perfil</strong> → actualiza tu número de WhatsApp con los 9 dígitos (ej: 9 1234 5678).
            </p>
          </td></tr>
        </table>
        ${btn(`${BASE_URL}/panel/perfil`, "Ir a mi perfil")}
      `);
      subject = `${firstName}, confirma tu WhatsApp en QuieroComer`;
      purpose = "whatsapp_confirmation";
    } else if (template === "reset_password") {
      const token = crypto.randomUUID();
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.restaurantOwner.update({ where: { id: owner.id }, data: { resetToken: token, resetTokenExpiry: expiry } });
      html = resetPasswordEmailHtml(firstName, `${BASE_URL}/panel/reset-password?token=${token}`);
      subject = "Recuperar contraseña";
      purpose = "reset_password";
    } else {
      return NextResponse.json({ error: "Template no valido" }, { status: 400 });
    }

    await sendAdminEmail({ to: owner.email, subject, html, purpose });
    return NextResponse.json({ ok: true, channel: "email", to: owner.email });

  } else if (channel === "whatsapp") {
    if (!owner.whatsapp) return NextResponse.json({ error: "Owner no tiene WhatsApp" }, { status: 400 });
    const tpl = WA_TEMPLATES[template];
    if (!tpl) return NextResponse.json({ error: "Template WA no valido" }, { status: 400 });

    const sid = await sendWhatsApp({
      to: owner.whatsapp,
      body: "",
      contentSid: tpl.sid,
      contentVariables: tpl.vars(firstName, restaurant.name),
    });

    if (!sid) return NextResponse.json({ error: "Error al enviar WhatsApp" }, { status: 500 });

    // Register in PanelActivity so it shows in lifecycle
    const actionName = template.startsWith("camila_") ? `nurturing_${template.replace("camila_", "")}` : `wa_manual_${template}`;
    await prisma.panelActivity.create({
      data: { restaurantId, action: actionName, details: { sid, whatsapp: owner.whatsapp, ownerName: firstName, template, manual: true } },
    }).catch(() => {});

    // Also log in WhatsAppMessage with exact template text
    const msgBody = tpl.text(firstName, restaurant.name);
    const lead = await prisma.lead.findFirst({ where: { whatsapp: { contains: owner.whatsapp.replace("+", "") } }, select: { id: true } }).catch(() => null);
    await prisma.whatsAppMessage.create({
      data: { phone: owner.whatsapp, direction: "OUTBOUND", body: msgBody, twilioSid: sid, status: "sent", restaurantId, leadId: lead?.id || null },
    }).catch(() => {});

    return NextResponse.json({ ok: true, channel: "whatsapp", to: owner.whatsapp, sid });

  } else {
    return NextResponse.json({ error: "Canal no valido" }, { status: 400 });
  }
}
