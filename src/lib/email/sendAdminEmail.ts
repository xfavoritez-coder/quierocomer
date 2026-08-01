import { resend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";

const FROM = process.env.FROM_EMAIL
  ? `QuieroComer <${process.env.FROM_EMAIL}>`
  : "QuieroComer <onboarding@resend.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  purpose?: string;
  /** Skip creating an emailLog (caller already created one, e.g. cron jobs with tracking) */
  skipLog?: boolean;
}

export async function sendAdminEmail({ to, subject, html, purpose = "other", skipLog }: SendEmailOptions) {
  // Create log first so we can inject tracking pixel
  let logId: string | undefined;
  if (!skipLog) {
    const log = await prisma.emailLog.create({
      data: { to, subject, purpose, status: "sent" },
    }).catch(() => null);
    logId = log?.id;
  }

  // Inject open pixel before </body> if we have a logId
  let trackedHtml = html;
  if (logId && html.includes("</body>")) {
    const pixel = `<img src="${BASE_URL}/api/email/track/open?eid=${logId}" alt="" width="1" height="1" style="display:none" />`;
    trackedHtml = html.replace("</body>", `${pixel}</body>`);
  }

  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html: trackedHtml, headers: { "Content-Type": "text/html; charset=UTF-8" } });

    if (error) {
      const errorMsg = error.message || JSON.stringify(error);
      console.error("Resend error:", errorMsg);
      if (logId) prisma.emailLog.update({ where: { id: logId }, data: { status: "failed", errorMsg } }).catch(() => {});
      throw new Error(errorMsg);
    }

    import("@/lib/costTracker").then(m => m.logResendUsage({ to, purpose })).catch(() => {});
    return { ...data, logId };
  } catch (err) {
    if (logId) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      prisma.emailLog.update({ where: { id: logId }, data: { status: "failed", errorMsg } }).catch(() => {});
    }
    throw err;
  }
}

// ─── Light email template ─────────────────────────────────────────────
// All emails use this base. Warm beige tones, table-based, email-safe.

const GOLD = "#e8930a";
const BASE_URL = "https://quierocomer.com";

/** Wrap arbitrary HTML content in the branded light template */
export function adminEmailTemplate(content: string): string {
  return wrap(`<tr><td style="padding-bottom:16px;">${content}</td></tr>`);
}

function wrap(content: string): string {
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

  ${content}

  <tr><td style="padding-top:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <a href="${BASE_URL}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.com</a>
    <br/><span style="font-size:10px;color:#ccc;">&copy; ${new Date().getFullYear()}</span>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function card(content: string, accent = false): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${accent ? "#fffbf3" : "#f9f6f0"};border:1px solid ${accent ? `${GOLD}33` : "#e8dcc4"};border-radius:14px;margin-bottom:16px;">
    <tr><td style="padding:16px 18px;">${content}</td></tr>
  </table>`;
}

export function btn(href: string, label: string, primary = true): string {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0;">
    <a href="${href}" style="display:inline-block;${primary ? `background:${GOLD};color:#fff;` : `background:#fffaf1;color:#6c4d22;border:1px solid #e8dcc4;`}font-size:15px;font-weight:800;padding:14px 32px;border-radius:14px;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

function label(text: string): string {
  return `<div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">${text}</div>`;
}

function field(name: string, value: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:10px;margin-bottom:6px;">
    <tr><td style="padding:10px 14px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:#92400e;margin-bottom:3px;">${name}</div>
      <div style="font-size:14px;color:#111;font-weight:700;word-break:break-word;">${value}</div>
    </td></tr>
  </table>`;
}

// ─── Email templates ──────────────────────────────────────────────────

export function resetPasswordEmailHtml(name: string, resetLink: string, restaurantName?: string): string {
  const firstName = name.split(" ")[0];
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:8px;">
    <div style="display:inline-block;width:56px;height:56px;background:#fff8ee;border:2px solid #ead7b7;border-radius:50%;line-height:56px;font-size:26px;">🔑</div>
  </td></tr>
  <tr><td style="padding-bottom:6px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.3;">
      Recuperar acceso
    </h1>
  </td></tr>
  ${restaurantName ? `
  <tr><td style="padding-bottom:16px;text-align:center;">
    <span style="display:inline-block;font-size:12px;font-weight:700;color:${GOLD};letter-spacing:0.06em;text-transform:uppercase;background:#fff8ee;border:1px solid #ead7b7;border-radius:20px;padding:4px 14px;">${restaurantName}</span>
  </td></tr>` : ""}
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:14px;">
      <tr><td style="padding:16px 20px;font-size:14px;color:#7a6547;line-height:1.7;">
        Hola <strong>${firstName}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta${restaurantName ? ` en <strong>${restaurantName}</strong>` : ""}.<br/>
        Si no fuiste tú, puedes ignorar este mensaje — tu contraseña no cambiará.
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding-bottom:20px;">${btn(resetLink, "Restablecer mi contraseña")}</td></tr>
  <tr><td style="padding-bottom:4px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf8f0;border:1px solid #e8dcc4;border-radius:10px;">
      <tr><td style="padding:10px 16px;font-size:12px;color:#b8a888;line-height:1.6;">
        🔒 Este link es de un solo uso y expira en <strong>1 hora</strong>.<br/>
        Si tienes problemas para acceder, contáctanos en <a href="mailto:hola@quierocomer.com" style="color:${GOLD};text-decoration:none;">hola@quierocomer.com</a>
      </td></tr>
    </table>
  </td></tr>
  `);
}


export function planActivatedEmailHtml(
  firstName: string, restaurantName: string, planLabel: string,
  amountPaid: string, nextChargeDate: string, nextChargeAmount: string,
  panelLink: string, qrLink: string,
): string {
  const feature = (icon: string, text: string) =>
    `<tr><td style="padding:5px 0;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:top;padding-right:10px;padding-top:1px;font-size:16px;">${icon}</td>
        <td style="font-size:14px;color:#5a3e1b;line-height:1.5;">${text}</td>
      </tr></table>
    </td></tr>`;

  return wrap(`
  <tr><td style="padding-bottom:6px;">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.2;">
      ¡Bienvenido al plan ${planLabel}, ${firstName}!
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.7;padding-bottom:24px;text-align:center;">
    <strong>${restaurantName}</strong> ya está activo con todas las herramientas para destacar y atraer más clientes.
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid #ead7b7;border-radius:16px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:11px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">A partir de hoy puedes</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${feature("🍽️", "Tener tu <strong>carta digital siempre actualizada</strong> — sin imprimir ni llamar a nadie.")}
          ${feature("📍", "Aparecer en el <strong>feed de QuieroComer</strong> para que nuevos clientes te descubran.")}
          ${feature("📊", "Ver <strong>estadísticas reales</strong> — qué platos miran más, cuántas visitas, de dónde vienen.")}
          ${feature("✏️", "Agregar fotos, precios, descripciones y categorías desde tu panel en segundos.")}
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-bottom:10px;">${btn(panelLink, "Abrir mi panel")}</td></tr>
  <tr><td style="padding-bottom:24px;">${btn(qrLink, "Ver mi carta en vivo", false)}</td></tr>

  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border-radius:12px;">
      <tr><td style="padding:12px 16px;">
        <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">Detalle del cobro</div>
        <div style="font-size:13px;color:#5a3e1b;line-height:1.8;">
          Cobrado hoy: <strong>${amountPaid}</strong><br/>
          Plan activo hasta: <strong>${nextChargeDate}</strong><br/>
          Renovación mensual: <strong>${nextChargeAmount}</strong>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="font-size:13px;color:#7a6547;line-height:1.6;text-align:center;padding-bottom:4px;">
  </td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">Puedes cancelar o cambiar de plan cuando quieras desde tu panel.</td></tr>
  `);
}

export function adminNewActivationEmailHtml(
  restaurantName: string, planLabel: string,
  amountCharged: string, ownerEmail: string, slug: string,
): string {
  return wrap(`
  <tr><td style="padding-bottom:16px;">
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Nuevo cliente activo ${planLabel}</h1>
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${field("Restaurante", restaurantName)}
    ${field("Plan", planLabel)}
    ${field("Cobrado", amountCharged)}
    ${field("Email dueño", ownerEmail)}
  `)}</td></tr>
  <tr><td style="text-align:center;font-size:13px;">
    <a href="${BASE_URL}/qr/${slug}" style="color:${GOLD};font-weight:700;text-decoration:none;">Ver carta</a>
    &nbsp;·&nbsp;
    <a href="${BASE_URL}/admin/funnel" style="color:${GOLD};font-weight:700;text-decoration:none;">Ver funnel</a>
  </td></tr>
  `);
}

export function cartaListaSimpleEmailHtml({
  ownerName,
  restaurantName,
  cartaUrl,
  openPixel,
  dishCount,
  categoryCount,
  logoUrl,
}: {
  ownerName: string;
  restaurantName: string;
  cartaUrl: string;
  openPixel: string;
  dishCount?: number;
  categoryCount?: number;
  logoUrl?: string | null;
}): string {
  const initials = restaurantName.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="" width="50" height="50" style="width:50px;height:50px;border-radius:14px;object-fit:cover;" />`
    : `<div style="width:50px;height:50px;border-radius:14px;background:#f5edd8;text-align:center;line-height:50px;font-family:Georgia,serif;font-size:18px;font-weight:700;color:${GOLD};">${initials}</div>`;
  const statsText = dishCount ? `${dishCount} platos${categoryCount ? ` · ${categoryCount} categorias` : ""}` : "";

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

  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.15;">
      ${ownerName}, tu carta esta lista
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Transformamos tu carta en una <strong style="color:${GOLD};">carta QR inteligente</strong>. Puedes verla ahora mismo.
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid #ead7b7;border-radius:18px;">
      <tr><td style="padding:18px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;padding-right:14px;" width="50">${logoHtml}</td>
          <td style="vertical-align:middle;">
            <p style="font-family:Georgia,serif;font-size:18px;font-weight:400;color:#1a1a1a;margin:0;">${restaurantName}</p>
            ${statsText ? `<p style="font-size:12px;color:#b8a888;margin:4px 0 0;">${statsText}</p>` : ""}
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-bottom:24px;">${btn(cartaUrl, "Ver mi carta →")}</td></tr>

  <tr><td style="padding-top:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:20px 0 0;">
    <p style="font-size:13px;color:#8a7550;margin:0 0 12px;">¿Tienes dudas? <a href="${BASE_URL}/#contacto" style="color:${GOLD};text-decoration:underline;font-weight:700;">Contactanos</a></p>
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td><a href="${BASE_URL}" style="font-family:Georgia,serif;font-size:13px;color:${GOLD};text-decoration:none;">QuieroComer.cl</a></td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">&copy; ${new Date().getFullYear()}</td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">Hecho en Chile</td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
<img src="${openPixel}" alt="" width="1" height="1" style="display:none" />
</body></html>`;
}

export function monthlyRenewalEmailHtml(
  firstName: string, restaurantName: string, planName: string,
  amount: string, nextChargeDate: string, panelLink: string, qrLink: string,
): string {
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:10px;"><span style="font-size:32px;">☑️</span></td></tr>
  <tr><td style="padding-bottom:6px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.2;">
      Todo sigue funcionando, ${firstName}.
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.7;padding-bottom:24px;text-align:center;">
    Tu plan <strong>${planName}</strong> de <strong>${restaurantName}</strong> se renovó automáticamente. Tu carta digital sigue activa y visible para tus clientes.
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border-radius:12px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Detalle del cobro</div>
        <div style="font-size:13px;color:#5a3e1b;line-height:2;">
          Cobrado: <strong>${amount}</strong><br/>
          Plan activo hasta: <strong>${nextChargeDate}</strong>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-bottom:10px;">${btn(qrLink, "Ver mi carta en vivo")}</td></tr>
  <tr><td style="padding-bottom:20px;">${btn(panelLink, "Ir al panel", false)}</td></tr>

  <tr><td style="font-size:13px;color:#7a6547;line-height:1.6;text-align:center;padding-bottom:4px;">
  </td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">Puedes cancelar o cambiar de plan cuando quieras desde tu panel.</td></tr>
  `);
}

export function renewalReminderEmailHtml(
  firstName: string, restaurantName: string, planName: string,
  amount: string, daysLeft: number, suscripcionLink: string,
): string {
  const dayLabel = daysLeft <= 1 ? "mañana" : `en ${daysLeft} días`;
  return wrap(`
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Tu plan vence ${dayLabel}</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    ${firstName}, el plan <strong>${planName}</strong> de <strong>${restaurantName}</strong> vence ${dayLabel}. Renuévalo para seguir disfrutando de todas las funciones.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Detalle de renovación")}
    ${field("Plan", planName)}
    ${field("Monto mensual", amount)}
    ${field("Restaurante", restaurantName)}
  `, true)}</td></tr>
  <tr><td style="padding-bottom:8px;">${btn(suscripcionLink, "Renovar mi plan")}</td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">Si no renuevas, tu carta seguirá activa en el plan Gratis.</td></tr>
  `);
}

export function trialEndingSoonEmailHtml(
  firstName: string, restaurantName: string,
  daysLeft: number, panelLink: string, suscripcionLink: string,
  slug?: string,
): string {
  const dayLabel = daysLeft === 1 ? "mañana" : `en ${daysLeft} días`;

  const featureRow = (icon: string, text: string) =>
    `<tr><td style="padding:6px 0;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="26" style="font-size:15px;vertical-align:middle;">${icon}</td>
        <td style="font-size:14px;color:#8a7550;line-height:1.4;">${text}</td>
      </tr></table>
    </td></tr>`;

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

  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.15;">
      ${firstName}, tu regalo Premium termina ${dayLabel}
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Los 7 días de Premium en <strong style="color:${GOLD};">${restaurantName}</strong> están por terminar. Tu carta <strong>seguirá activa</strong> en el plan Gratis, pero estas funciones dejarán de estar disponibles:
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid #ead7b7;border-radius:18px;">
      <tr><td style="padding:18px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${featureRow("📊", "Estadísticas de visitas y platos más vistos")}
          ${featureRow("🌙", "Modo oscuro y claro")}
          ${featureRow("🏷️", "Ofertas y promociones en la carta")}
          ${featureRow("⭐", "Destacar platos estrella")}
          ${featureRow("🌍", "Carta en inglés y portugués")}
          ${featureRow("🔔", "Botón llamar al garzón")}
          ${featureRow("🎂", "Captación de cumpleaños")}
        </table>
      </td></tr>
    </table>
  </td></tr>

  ${slug ? `<tr><td style="padding-bottom:12px;">${btn(`${BASE_URL}/qr/${slug}`, "Ver mi carta")}</td></tr>` : ""}

  <tr><td style="padding-bottom:24px;">${btn(suscripcionLink, "Ver planes", false)}</td></tr>

  <tr><td style="padding-top:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:20px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td><a href="${BASE_URL}" style="font-family:Georgia,serif;font-size:13px;color:${GOLD};text-decoration:none;">QuieroComer.cl</a></td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">Hecho en Chile</td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">&copy; ${new Date().getFullYear()}</td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

const TRANSFER_BLOCK = `
  <tr><td style="padding-bottom:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border:1px solid #e8dcc4;border-radius:12px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-size:10px;color:#92400e;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Realiza tu transferencia hoy</div>
        <div style="font-size:13px;color:#5a3e1b;line-height:2;">
          Banco: <strong>BCI</strong><br/>
          Tipo: <strong>Cuenta corriente</strong><br/>
          N°: <strong>69584989</strong><br/>
          Nombre: <strong>Evolucion Gastronomica Spa</strong><br/>
          RUT: <strong>78.123.543-1</strong><br/>
          Email: <strong>hola@quierocomer.cl</strong>
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;padding-top:4px;">Una vez recibida la transferencia activamos tu plan de inmediato.</td></tr>`;

/**
 * 2-day advance expiry warning (sent when currentPeriodEnd = today + 2 days).
 * paymentMethod: "transfer" → shows bank data so they can initiate the transfer early
 *                "online"   → shows CTA button to renew
 */
export function planExpiringSoonEmailHtml({
  restaurantName,
  planLabel,
  expiryDate,
  panelLink,
  paymentMethod,
}: {
  restaurantName: string;
  planLabel: string;
  expiryDate: string;
  panelLink: string;
  paymentMethod: "transfer" | "online";
}): string {
  const actionBlock = paymentMethod === "transfer"
    ? TRANSFER_BLOCK
    : `<tr><td style="padding-bottom:8px;">${btn(panelLink, "Renovar mi plan →")}</td></tr>`;

  return wrap(`
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.2;">
      Tu plan vence en 2 días
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.7;padding-bottom:24px;text-align:center;">
    El plan ${planLabel} de <strong>${restaurantName}</strong> vence el ${expiryDate}. Renueva antes para seguir sin interrupciones.
  </td></tr>
  ${actionBlock}
  `);
}

/**
 * Same-day expiry email (sent when currentPeriodEnd = today).
 * paymentMethod: "transfer" → shows bank data only
 *                "online"   → shows auto-login CTA button
 */
export function planExpiryTodayEmailHtml({
  restaurantName,
  planLabel,
  expiryDate,
  panelLink,
  paymentMethod,
}: {
  restaurantName: string;
  planLabel: string;
  expiryDate: string;
  panelLink: string;
  paymentMethod: "transfer" | "online";
}): string {
  const actionBlock = paymentMethod === "transfer"
    ? TRANSFER_BLOCK
    : `<tr><td style="padding-bottom:8px;">${btn(panelLink, "Renovar mi plan →")}</td></tr>`;

  return wrap(`
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.2;">
      Tu plan vence hoy, ${expiryDate}
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.7;padding-bottom:24px;text-align:center;">
    El plan ${planLabel} de <strong>${restaurantName}</strong> vence hoy. Renueva antes de la medianoche para seguir sin interrupciones.
  </td></tr>
  ${actionBlock}
  `);
}

/**
 * Grace period expiry warning email (sent on grace day +2: "se desactiva mañana").
 * paymentMethod: "transfer" → shows bank data only (no CTA button)
 *                "online"   → shows CTA button only (no bank data)
 */
export function graceExpiryWarningEmailHtml({
  restaurantName,
  planLabel,
  expiryDate,
  panelLink,
  paymentMethod,
}: {
  restaurantName: string;
  planLabel: string;
  /** Formatted date string, e.g. "16 de julio" */
  expiryDate: string;
  panelLink: string;
  paymentMethod: "transfer" | "online";
}): string {
  const actionBlock = paymentMethod === "transfer"
    ? TRANSFER_BLOCK
    : `<tr><td style="padding-bottom:8px;">${btn(panelLink, "Renovar mi plan →")}</td></tr>`;

  return wrap(`
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.2;">
      Tu carta QR se desactiva mañana
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.7;padding-bottom:24px;text-align:center;">
    El plan ${planLabel} de <strong>${restaurantName}</strong> vence hoy, ${expiryDate}. Renueva antes de la medianoche para no perder nada.
  </td></tr>

  ${actionBlock}
  `);
}

export function trialExpiredEmailHtml(
  firstName: string, restaurantName: string, suscripcionLink: string, cartaUrl?: string,
): string {
  const planRow = (name: string, price: string, color: string, features: string, isLast = false) => `
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="${!isLast ? "padding-bottom:13px;border-bottom:1px solid rgba(193,151,82,0.22);margin-bottom:13px;" : ""}">
  <tr>
    <td style="vertical-align:top;padding-right:12px;">
      <p style="font-size:15px;margin:0 0 4px;font-weight:800;color:${color}">${name}</p>
      <p style="margin:0;color:#836a47;font-size:13px;line-height:1.45">${features}</p>
    </td>
    <td style="vertical-align:top;text-align:right;white-space:nowrap;">
      <p style="font-size:15px;font-weight:800;color:#8a7550;margin:0">${price}</p>
      <p style="font-size:11px;color:#b8a888;margin:2px 0 0">/mes</p>
    </td>
  </tr>
  </table>`;

  const featureRow = (icon: string, text: string) =>
    `<tr><td style="padding:4px 0;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="26" style="font-size:15px;vertical-align:middle;opacity:0.4;">${icon}</td>
        <td style="font-size:14px;color:#b8a888;line-height:1.4;text-decoration:line-through;">${text}</td>
      </tr></table>
    </td></tr>`;

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

  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.15;">
      ${firstName}, tu regalo Premium terminó
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Los 7 días de Premium en <strong style="color:${GOLD};">${restaurantName}</strong> terminaron. Tu carta <strong>sigue activa</strong> en el plan Gratis, pero estas funciones ya no están disponibles:
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid #ead7b7;border-radius:18px;">
      <tr><td style="padding:18px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${featureRow("📊", "Estadísticas de visitas y platos")}
          ${featureRow("🌙", "Modo oscuro y claro")}
          ${featureRow("🏷️", "Ofertas y promociones")}
          ${featureRow("⭐", "Destacar platos estrella")}
          ${featureRow("🌍", "Traducciones automáticas")}
          ${featureRow("🔔", "Botón llamar garzón")}
          ${featureRow("🎂", "Captación de cumpleaños")}
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="font-size:15px;color:#8a7550;line-height:1.5;padding-bottom:20px;text-align:center;">
    Si quieres recuperar estas funciones, elige un plan desde tu panel:
  </td></tr>

  <tr><td style="padding-bottom:${cartaUrl ? "12" : "24"}px;">${btn(suscripcionLink, "Ver planes")}</td></tr>
  ${cartaUrl ? `<tr><td style="padding-bottom:24px;">${btn(cartaUrl, "Ver mi carta →", false)}</td></tr>` : ""}

  <tr><td style="padding-top:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:20px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td><a href="${BASE_URL}" style="font-family:Georgia,serif;font-size:13px;color:${GOLD};text-decoration:none;">QuieroComer.cl</a></td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">Hecho en Chile</td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">&copy; ${new Date().getFullYear()}</td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
