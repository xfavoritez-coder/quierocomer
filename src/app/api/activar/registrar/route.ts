import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
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
  const panelStaticUrl = `https://quierocomer.com/panel`;
  return `<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>

<!-- Logo -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:16px">
  <a href="${BASE_URL}" style="text-decoration:none;"><table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td style="vertical-align:middle;padding-right:3px;"><img src="https://quierocomer.cl/logo.png" alt="" width="24" height="24" style="width:24px;height:24px;display:block;" /></td>
    <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:#e8930a;">QuieroComer</span></td>
  </tr></table></a>
</td></tr>
</table>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 24px 70px rgba(70,45,10,0.10)">
<tr><td style="padding:28px 22px 24px">

<!-- Title -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:10px">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:0;color:#111111">
  ${restaurantName}<br/>ya tiene su panel
</h1>
</td></tr>
</table>

<!-- Lead text -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:20px">
<p style="font-size:15px;color:#7a6547;line-height:1.55;margin:0">
  ${firstName}, tu cuenta está activa con <strong style="color:#111">7 días Premium gratis</strong>.
</p>
</td></tr>
</table>

<!-- Credentials card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #ead7b7;border-radius:22px;margin-bottom:22px">
<tr><td style="padding:22px 20px">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="text-align:center;padding-bottom:14px">
      <span style="font-size:22px">🔐</span>
    </td></tr>
    <tr><td style="text-align:center;padding-bottom:16px">
      <p style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:800;color:#92400e;margin:0">Tus datos de acceso</p>
    </td></tr>
  </table>

  <!-- Email -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px">
  <tr><td style="padding:12px 14px">
    <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Email</p>
    <p style="font-size:14px;color:#111;font-weight:700;margin:0;word-break:break-word">${email}</p>
  </td></tr>
  </table>

  <!-- Password -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px">
  <tr><td style="padding:12px 14px">
    <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Contraseña</p>
    <p style="font-size:14px;color:#111;font-weight:700;margin:0;font-family:monospace,sans-serif;letter-spacing:0.5px">${password}</p>
  </td></tr>
  </table>

  <!-- Panel link -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:12px">
  <tr><td style="padding:12px 14px">
    <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Tu panel</p>
    <a href="${panelStaticUrl}" style="font-size:14px;color:#e8930a;font-weight:700;text-decoration:none;word-break:break-word">${panelStaticUrl}</a>
  </td></tr>
  </table>

  <p style="color:#8a724f;font-size:11px;margin:0;line-height:1.45;text-align:center">Te recomendamos cambiar la contraseña en tu primer ingreso.</p>
</td></tr>
</table>

<!-- CTA -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:22px">
  <a href="${autoLoginUrl}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:18px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;box-shadow:0 14px 26px rgba(242,154,0,0.28)">
    Entrar a mi panel →
  </a>
</td></tr>
</table>

</td></tr>
</table>

<!-- Footer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:20px">
  <p style="color:#b8a888;font-size:11px;margin:0">QuieroComer.cl · ${new Date().getFullYear()} · Hecho en Chile</p>
</td></tr>
</table>

</td></tr>
</table>
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

    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
        trialEndsAt: trialEnd,
        // Loyalty trial activo desde el día 1
        loyaltyStatus: "TRIALING",
        loyaltyTrialEndsAt: trialEnd,
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
    sendAdminEmail({
      to: email.trim().toLowerCase(),
      subject: `Bienvenida a QuieroComer, ${ownerName.split(" ")[0]} 🎉`,
      html: welcomeEmailHtml({
        ownerName,
        restaurantName: localName,
        email: email.trim().toLowerCase(),
        password: generatedPassword,
        autoLoginUrl,
      }),
      purpose: "activation_welcome",
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
