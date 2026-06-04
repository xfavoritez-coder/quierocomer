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
const BASE_URL = "https://quierocomer.cl";

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
      <td style="vertical-align:middle;padding-right:3px;"><img src="${BASE_URL}/landing/logo.png" alt="" width="26" height="20" style="width:26px;height:20px;display:block;" /></td>
      <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:${GOLD};">QuieroComer</span></td>
    </tr></table></a>
  </td></tr>

  ${content}

  <tr><td style="padding-top:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <a href="${BASE_URL}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.cl</a>
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

export function resetPasswordEmailHtml(name: string, resetLink: string): string {
  return wrap(`
  <tr><td style="padding-bottom:20px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Recuperar contraseña</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;">
    Hola ${name}, recibiste este email porque solicitaste recuperar tu contraseña. Si no fuiste tu, ignora este mensaje.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${btn(resetLink, "Restablecer contraseña")}</td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">Este link expira en 1 hora.</td></tr>
  `);
}


export function planActivatedEmailHtml(
  firstName: string, restaurantName: string, planLabel: string,
  amountPaid: string, nextChargeDate: string, nextChargeAmount: string,
  panelLink: string, qrLink: string,
): string {
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">🎉</span></td></tr>
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Plan ${planLabel} activado</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    ${firstName}, tu carta de <strong>${restaurantName}</strong> ya funciona con el plan <strong>${planLabel}</strong>.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Detalle del pago")}
    ${field("Cobrado hoy", amountPaid)}
    ${field("Plan activo hasta", nextChargeDate)}
    ${field("Valor mensual", nextChargeAmount)}
  `, true)}</td></tr>
  <tr><td style="padding-bottom:8px;">${btn(panelLink, "Entrar al panel")}</td></tr>
  <tr><td style="padding-bottom:16px;">${btn(qrLink, "Ver mi carta", false)}</td></tr>
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
      <td style="vertical-align:middle;padding-right:3px;"><img src="${BASE_URL}/landing/logo.png" alt="" width="26" height="20" style="width:26px;height:20px;display:block;" /></td>
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
  amount: string, panelLink: string,
): string {
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">✅</span></td></tr>
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Tu plan se renovó</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    ${firstName}, tu plan <strong>${planName}</strong> en <strong>${restaurantName}</strong> se renovó exitosamente. Tu carta sigue activa sin interrupciones.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Cobro del mes")}
    ${field("Monto cobrado", amount)}
    ${field("Plan", planName)}
    ${field("Restaurante", restaurantName)}
  `, true)}</td></tr>
  <tr><td style="padding-bottom:8px;">${btn(panelLink, "Ir a mi panel")}</td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">Gracias por confiar en QuieroComer. Puedes cancelar o cambiar de plan cuando quieras desde tu panel.</td></tr>
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
      <td style="vertical-align:middle;padding-right:3px;"><img src="${BASE_URL}/landing/logo.png" alt="" width="26" height="20" style="width:26px;height:20px;display:block;" /></td>
      <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:${GOLD};">QuieroComer</span></td>
    </tr></table></a>
  </td></tr>

  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.15;">
      ${firstName}, tu regalo Premium termina ${dayLabel}
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Los 14 días de Premium en <strong style="color:${GOLD};">${restaurantName}</strong> están por terminar. Tu carta <strong>seguirá activa</strong> en el plan Gratis, pero estas funciones dejarán de estar disponibles:
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

  <tr><td style="padding-bottom:12px;">${btn(suscripcionLink, "Ver planes disponibles")}</td></tr>

  ${slug ? `<tr><td style="padding-bottom:24px;" align="center">
    <a href="${BASE_URL}/qr/${slug}" style="display:inline-block;font-size:14px;color:${GOLD};font-weight:700;text-decoration:none;padding:14px 28px;border:1.5px solid #ead7b7;border-radius:14px;background:#fffbf3;">
      👁 Ver mi carta
    </a>
  </td></tr>` : ""}

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

export function trialExpiredEmailHtml(
  firstName: string, restaurantName: string, suscripcionLink: string,
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
      <td style="vertical-align:middle;padding-right:3px;"><img src="${BASE_URL}/landing/logo.png" alt="" width="26" height="20" style="width:26px;height:20px;display:block;" /></td>
      <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:${GOLD};">QuieroComer</span></td>
    </tr></table></a>
  </td></tr>

  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.15;">
      ${firstName}, tu regalo Premium terminó
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Los 14 días de Premium en <strong style="color:${GOLD};">${restaurantName}</strong> terminaron. Tu carta <strong>sigue activa</strong> en el plan Gratis, pero estas funciones ya no están disponibles:
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

  <tr><td style="padding-bottom:24px;">${btn(suscripcionLink, "Ver planes")}</td></tr>

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
