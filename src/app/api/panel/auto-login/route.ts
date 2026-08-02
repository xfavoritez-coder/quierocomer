import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { buildAutoLoginUrl } from "@/lib/email/autoLoginUrl";
import { sendWhatsApp, buildLoyaltyTrialMessage } from "@/lib/whatsapp";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 40; // 40 days
const IS_PROD = process.env.NODE_ENV === "production";
const SECRET = process.env.AUTO_LOGIN_SECRET || "qc-auto-login-secret-2026";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/**
 * Auto-login via signed token from email links.
 * GET /api/panel/auto-login?oid=<ownerId>&sig=<signature>&t=<timestamp>
 *
 * Token is valid for 7 days.
 * Clicking this link:
 *   1. Marks email as verified.
 *   2. If this is a new account (subscriptionStatus NONE), activates the 7-day trial,
 *      sends credentials email + WhatsApp, and redirects to /bienvenida with welcome data.
 *   3. Otherwise redirects to /panel as usual.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const oid = searchParams.get("oid");
  const sig = searchParams.get("sig");
  const t = searchParams.get("t");

  if (!oid || !sig || !t) {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  // Verify HMAC signature
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${oid}:${t}`)
    .digest("hex")
    .slice(0, 16);

  if (sig !== expected) {
    return NextResponse.redirect(new URL("/panel/login?error=invalid_link", req.url));
  }

  // Check expiry (7 days)
  const ts = parseInt(t, 10);
  if (isNaN(ts) || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.redirect(new URL("/panel/login?error=expired", req.url));
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: oid },
    select: { id: true, role: true, status: true, name: true, email: true, whatsapp: true, emailVerificado: true },
  });

  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  const isFirstConfirmation = !owner.emailVerificado;

  // Mark email as verified
  await prisma.restaurantOwner.update({
    where: { id: oid },
    data: { lastLoginAt: new Date(), emailVerificado: true, emailVerificadoAt: new Date() },
  });

  // ── New account activation ─────────────────────────────────────────────────
  let welcomeCookie: string | null = null;

  if (isFirstConfirmation) {
    // Check if any restaurant is still NONE (unactivated new account)
    const pendingRestaurants = await prisma.restaurant.findMany({
      where: { ownerId: oid, subscriptionStatus: "NONE" },
      select: { id: true, name: true, slug: true },
    });

    if (pendingRestaurants.length > 0) {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const restaurant = pendingRestaurants[0];

      // Activate trial
      await prisma.restaurant.updateMany({
        where: { ownerId: oid, subscriptionStatus: "NONE" },
        data: {
          plan: "PREMIUM",
          subscriptionStatus: "TRIALING",
          trialEndsAt: trialEnd,
          loyaltyStatus: "TRIALING",
          loyaltyTrialEndsAt: trialEnd,
        },
      });

      // Activate lead
      await prisma.lead.updateMany({
        where: { convertedToOwnerId: oid, activated: false },
        data: { activated: true, activatedAt: new Date() },
      });

      // Generate password for credentials email
      const cleanName = restaurant.name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
      const newPassword = `${cleanName}2026`;
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.restaurantOwner.update({ where: { id: oid }, data: { passwordHash } });

      // Create PanelShortLink for WhatsApp deep-link
      const shortLink = await prisma.panelShortLink.create({ data: { ownerId: oid } });

      // Send credentials email
      const newAutoLoginUrl = buildAutoLoginUrl(BASE_URL, oid);
      sendAdminEmail({
        to: owner.email,
        subject: `🔑 Credenciales de acceso para ${restaurant.name}`,
        html: credentialsEmailHtml({
          ownerName: owner.name,
          restaurantName: restaurant.name,
          email: owner.email,
          password: newPassword,
          autoLoginUrl: newAutoLoginUrl,
        }),
        purpose: "activation_welcome",
      }).catch((err) => console.error("[auto-login] credentials email error:", err));

      // Send WhatsApp
      if (owner.whatsapp) {
        const waMsg = buildLoyaltyTrialMessage({
          ownerName: owner.name,
          restaurantName: restaurant.name,
          shortId: shortLink.id,
        });
        sendWhatsApp({ to: owner.whatsapp, ...waMsg })
          .catch((err) => console.error("[auto-login] whatsapp error:", err));
      }

      // Set welcome cookie (5 min, readable by JS) so /bienvenida shows credentials
      welcomeCookie = JSON.stringify({
        localName: restaurant.name,
        ownerName: owner.name,
        email: owner.email,
        password: newPassword,
        slug: restaurant.slug,
      });
    }
  }

  const token = crypto.randomUUID();
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  const redirect = searchParams.get("redirect");
  const destination = welcomeCookie
    ? "/bienvenida"
    : (redirect && redirect.startsWith("/panel") ? redirect : "/panel");

  const response = NextResponse.redirect(new URL(destination, req.url));
  response.cookies.set("panel_token", token, { ...base, httpOnly: true });
  response.cookies.set("panel_role", owner.role, { ...base, httpOnly: true });
  response.cookies.set("panel_id", oid, { ...base, httpOnly: true });
  response.cookies.set("panel_ev", "1", { ...base, httpOnly: true });
  response.cookies.set("panel_logged", "1", { ...base, httpOnly: false });

  if (welcomeCookie) {
    response.cookies.set("qc_wb", encodeURIComponent(welcomeCookie), {
      path: "/bienvenida",
      maxAge: 300, // 5 min — just enough to load the page
      httpOnly: false,
      sameSite: "lax",
      secure: IS_PROD,
    });
  }

  return response;
}

// ── Credentials email (sent after email confirmation) ─────────────────────────
function credentialsEmailHtml({
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
  const panelUrl = "https://quierocomer.com/panel";
  return `<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:16px">
  <a href="https://quierocomer.com" style="text-decoration:none;"><table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td style="vertical-align:middle;padding-right:3px;"><img src="https://quierocomer.cl/logo.png" alt="" width="24" height="24" style="display:block;" /></td>
    <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:#e8930a;">QuieroComer</span></td>
  </tr></table></a>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 24px 70px rgba(70,45,10,0.10)">
<tr><td style="padding:28px 22px 24px">
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:10px">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:0;color:#111111">
  ${restaurantName}<br/>ya está activo 🎉
</h1>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:20px">
<p style="font-size:15px;color:#7a6547;line-height:1.55;margin:0">
  ${firstName}, tu cuenta está activa con <strong style="color:#111">7 días Premium gratis</strong>.
</p>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #ead7b7;border-radius:22px;margin-bottom:22px">
<tr><td style="padding:22px 20px">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="text-align:center;padding-bottom:16px">
      <p style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:800;color:#92400e;margin:0">Tus datos de acceso</p>
    </td></tr>
  </table>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px">
  <tr><td style="padding:12px 14px">
    <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Email</p>
    <p style="font-size:14px;color:#111;font-weight:700;margin:0;word-break:break-word">${email}</p>
  </td></tr>
  </table>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:12px">
  <tr><td style="padding:12px 14px">
    <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Contraseña</p>
    <p style="font-size:14px;color:#111;font-weight:700;margin:0;font-family:monospace,sans-serif;letter-spacing:0.5px">${password}</p>
  </td></tr>
  </table>
  <p style="color:#8a724f;font-size:11px;margin:0;line-height:1.45;text-align:center">Te recomendamos cambiar la contraseña en tu primer ingreso.</p>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:22px">
  <a href="${autoLoginUrl}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:18px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;box-shadow:0 14px 26px rgba(242,154,0,0.28)">
    Entrar a mi panel →
  </a>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center">
  <a href="${panelUrl}" style="font-size:12px;color:#b8a888;">${panelUrl}</a>
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
