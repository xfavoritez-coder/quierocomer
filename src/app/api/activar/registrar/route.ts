import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { buildAutoLoginUrl } from "@/lib/email/autoLoginUrl";

/**
 * POST /api/activar/registrar
 * Body: { localName, ownerName, email, whatsapp }
 *
 * Crea un restaurant (sin platos de ejemplo) + owner + Lead para activación desde la landing.
 * Retorna auto-login URL para redirigir a /bienvenida.
 */

const BASE_URL = "https://quierocomer.com";
const FROM_EMAIL = process.env.FROM_EMAIL
  ? `QuieroComer <${process.env.FROM_EMAIL}>`
  : "QuieroComer <onboarding@resend.dev>";
const GOLD = "#e8930a";

function welcomeEmailHtml({
  ownerName,
  restaurantName,
  email,
  password,
  autoLoginUrl,
}: {
  ownerName: string;
  restaurantName: string;
  email: string;
  password: string;
  autoLoginUrl: string;
}): string {
  const firstName = ownerName.split(" ")[0];
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">

  <tr><td align="center" style="padding-bottom:24px;">
    <a href="${BASE_URL}" style="text-decoration:none;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:6px;"><img src="${BASE_URL}/logo.png" alt="" width="22" height="22" style="width:22px;height:22px;display:block;" /></td>
      <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:${GOLD};">QuieroComer</span></td>
    </tr></table></a>
  </td></tr>

  <tr><td style="text-align:center;padding-bottom:8px;"><span style="font-size:40px;">🎉</span></td></tr>

  <tr><td style="padding-bottom:6px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.3;">
      Bienvenido, ${firstName}
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.65;padding-bottom:24px;text-align:center;">
    Tu local <strong style="color:${GOLD};">${restaurantName}</strong> ya tiene cuenta activa en QuieroComer con <strong>7 días Premium gratis</strong>.
  </td></tr>

  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid #ead7b7;border-radius:14px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">Tus datos de acceso</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:10px;margin-bottom:8px;">
          <tr><td style="padding:10px 14px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:#92400e;margin-bottom:3px;">Email</div>
            <div style="font-size:14px;color:#111;font-weight:700;word-break:break-word;">${email}</div>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:10px;">
          <tr><td style="padding:10px 14px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:#92400e;margin-bottom:3px;">Contraseña</div>
            <div style="font-size:14px;color:#111;font-weight:700;word-break:break-word;">${password}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:14px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Primeros pasos</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:5px 0;font-size:14px;color:#5a3e1b;line-height:1.5;"><span style="color:${GOLD};margin-right:8px;font-weight:800;">1.</span> Entra a tu panel y agrega tus platos con fotos</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#5a3e1b;line-height:1.5;"><span style="color:${GOLD};margin-right:8px;font-weight:800;">2.</span> Genera tu QR y ponlo en las mesas</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#5a3e1b;line-height:1.5;"><span style="color:${GOLD};margin-right:8px;font-weight:800;">3.</span> Comparte el link de tu carta en redes sociales</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-bottom:16px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0;">
      <a href="${autoLoginUrl}" style="display:inline-block;background:${GOLD};color:#fff;font-size:15px;font-weight:800;padding:14px 32px;border-radius:14px;text-decoration:none;">Entrar a mi panel →</a>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding-top:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <p style="font-size:12px;color:#b8a888;margin:0 0 4px;">¿Tienes dudas? Escríbenos a <a href="mailto:hola@quierocomer.com" style="color:${GOLD};text-decoration:none;">hola@quierocomer.com</a></p>
    <a href="${BASE_URL}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.com</a>
    <br/><span style="font-size:10px;color:#ccc;">&copy; ${new Date().getFullYear()}</span>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  let body: { localName?: string; ownerName?: string; email?: string; whatsapp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { localName: rawLocalName, ownerName: rawOwnerName, email, whatsapp } = body;
  if (!rawLocalName?.trim() || !email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Completa nombre del local y email" }, { status: 400 });
  }

  // Title Case: "horus vegan" → "Horus Vegan"
  const toTitleCase = (s: string) => s.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const localName = toTitleCase(rawLocalName);
  const ownerName = rawOwnerName?.trim() ? toTitleCase(rawOwnerName) : localName;

  try {
    // Generar slug
    let slug = localName.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) slug = "mi-local";
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    // Password basado en nombre del local (sin espacios ni tildes)
    const cleanForPassword = localName.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    const generatedPassword = `${cleanForPassword}2026`;
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    // Crear o encontrar owner
    let owner = await prisma.restaurantOwner.findFirst({ where: { email: email.trim().toLowerCase() } });
    if (!owner) {
      owner = await prisma.restaurantOwner.create({
        data: {
          name: ownerName.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: "OWNER",
          whatsapp: whatsapp?.trim() || undefined,
        },
      });
    } else {
      owner = await prisma.restaurantOwner.update({
        where: { id: owner.id },
        data: { passwordHash },
      });
    }

    // Crear restaurant sin platos de ejemplo
    const restaurant = await prisma.restaurant.create({
      data: {
        name: localName.trim(),
        slug,
        cartaTheme: "PREMIUM",
        cartaColorMode: "DARK",
        defaultView: "impact",
        enabledLangs: ["es", "en", "pt"],
        isActive: true,
        isDemo: true,
        weeklyEmailEnabled: true,
        qrToken,
        qrActivatedAt: new Date(),
        plan: "PREMIUM",
        subscriptionStatus: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        ownerId: owner.id,
        allPhotosReferential: false,
      },
    });

    // Crear Lead para que aparezca en funnel/lifecycle/clientes
    await prisma.lead.create({
      data: {
        localName: localName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp?.trim() || null,
        cartaType: "LINK",
        cartaUrl: null,
        cartaStatus: "DELIVERED",
        activated: true,
        activatedAt: new Date(),
        completedAt: new Date(),
        generatedSlug: restaurant.slug,
        convertedToOwnerId: owner.id,
      },
    });

    // Generar auto-login URL
    const autoLoginUrl = buildAutoLoginUrl(BASE_URL, owner.id);

    // Enviar email de bienvenida con credenciales
    resend.emails.send({
      from: FROM_EMAIL,
      to: email.trim().toLowerCase(),
      subject: `Bienvenido a QuieroComer, ${ownerName.split(" ")[0]} 🎉`,
      html: welcomeEmailHtml({
        ownerName,
        restaurantName: localName,
        email: email.trim().toLowerCase(),
        password: generatedPassword,
        autoLoginUrl,
      }),
    }).catch((err: unknown) => {
      console.error("[registrar] Error sending welcome email:", err);
    });

    return NextResponse.json({
      ok: true,
      slug: restaurant.slug,
      email: email.trim().toLowerCase(),
      generatedPassword,
      autoLoginUrl,
      ownerName,
      localName,
    });
  } catch (err: any) {
    console.error("[activar/registrar] error:", err);
    return NextResponse.json({ error: err?.message || "Error interno al crear el local" }, { status: 500 });
  }
}
