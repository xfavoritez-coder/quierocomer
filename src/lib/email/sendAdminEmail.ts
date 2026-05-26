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
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html, headers: { "Content-Type": "text/html; charset=UTF-8" } });

    if (error) {
      const errorMsg = error.message || JSON.stringify(error);
      console.error("Resend error:", errorMsg);
      if (!skipLog) {
        await prisma.emailLog.create({
          data: { to, subject, purpose, status: "failed", errorMsg },
        }).catch(() => {});
      }
      throw new Error(errorMsg);
    }

    let logId: string | undefined;
    if (!skipLog) {
      const log = await prisma.emailLog.create({
        data: { to, subject, purpose, status: "sent" },
      }).catch(() => null);
      logId = log?.id;
    }
    return { ...data, logId };
  } catch (err) {
    if (!skipLog && !(err instanceof Error && err.message.startsWith("Resend"))) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.create({
        data: { to, subject, purpose, status: "failed", errorMsg },
      }).catch(() => {});
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
    <img src="${BASE_URL}/landing/logo.png" alt="QuieroComer" width="28" height="28" style="width:28px;height:28px;margin:0 auto 8px;display:block;" />
    <span style="font-family:Georgia,serif;font-size:16px;color:${GOLD};">QuieroComer</span>
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

function btn(href: string, label: string, primary = true): string {
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

export function welcomeOwnerEmailHtml(name: string, email: string, password: string, qrLink: string | null, panelLink: string): string {
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">🎉</span></td></tr>
  <tr><td style="padding-bottom:16px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Todo listo, ${name}</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Tu carta QR ya esta funcionando. Sigue estos pasos para dejar todo listo.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Tus datos de acceso")}
    ${field("Email", email)}
    ${field("Contraseña", password)}
    <div style="font-size:11px;color:#927955;margin-top:8px;">Te recomendamos cambiar la contraseña en tu primer ingreso.</div>
  `, true)}</td></tr>
  ${qrLink ? `<tr><td style="padding-bottom:8px;">${btn(qrLink, "Ver mi carta →")}</td></tr>` : ""}
  <tr><td style="padding-bottom:16px;">${btn(panelLink, "Entrar al panel", false)}</td></tr>
  `);
}

export function handoffOwnerEmailHtml(
  name: string, email: string, password: string,
  qrLink: string | null, panelLink: string, planLabel: string, trialDays: number,
): string {
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">🎉</span></td></tr>
  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Bienvenido, ${name}</h1>
  </td></tr>
  <tr><td style="text-align:center;padding-bottom:20px;">
    <span style="background:#fff3d8;color:#9a5a00;font-size:12px;font-weight:800;padding:6px 12px;border-radius:50px;">✨ ${planLabel} · ${trialDays} dias gratis</span>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;">
    Tu carta digital ya esta funcionando con el plan <strong>${planLabel}</strong>. Tienes <strong>${trialDays} dias gratis</strong> para probarla con tus clientes reales.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Tus datos de acceso")}
    ${field("Email", email)}
    ${field("Contraseña", password)}
  `, true)}</td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Para no perder tu plan")}
    <div style="font-size:14px;color:#7a6547;line-height:1.6;">Tienes ${trialDays} días para probar todas las funciones. Al terminar, puedes pagar desde tu panel para mantener el plan.</div>
  `)}</td></tr>
  ${qrLink ? `<tr><td style="padding-bottom:8px;">${btn(qrLink, "Ver mi carta →")}</td></tr>` : ""}
  <tr><td style="padding-bottom:16px;">${btn(panelLink, "Entrar al panel", false)}</td></tr>
  `);
}

export function handoffFreeEmailHtml(
  name: string, email: string, password: string,
  qrLink: string, panelLink: string, restaurantName: string,
): string {
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">🎉</span></td></tr>
  <tr><td style="padding-bottom:16px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">Bienvenido, ${name}</h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Tu carta digital de <strong>${restaurantName}</strong> ya esta lista.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Tus datos de acceso")}
    ${field("Email", email)}
    ${field("Contraseña", password)}
  `, true)}</td></tr>
  <tr><td style="padding-bottom:8px;">${btn(qrLink, "Ver mi carta →")}</td></tr>
  <tr><td style="padding-bottom:16px;">${btn(panelLink, "Entrar al panel", false)}</td></tr>
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
}: {
  ownerName: string;
  restaurantName: string;
  cartaUrl: string;
  openPixel: string;
}): string {
  return wrap(`
  <tr><td style="padding-bottom:16px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">
      ${ownerName}, tu carta está lista
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Transformamos la carta de <strong>${restaurantName}</strong> en una carta digital. Puedes verla ahora mismo.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${btn(cartaUrl, "Ver mi carta →")}</td></tr>
  <tr><td style="font-size:13px;color:#b8a888;text-align:center;line-height:1.6;">
    ¿Quieres editar los platos, precios o fotos?<br/>
    Pronto recibirás acceso a tu panel de administración.
  </td></tr>
  <img src="${openPixel}" alt="" width="1" height="1" style="display:none" />
  `);
}

export function trialEndingSoonEmailHtml(
  firstName: string, restaurantName: string,
  daysLeft: number, panelLink: string, facturacionLink: string,
): string {
  const dayLabel = daysLeft === 1 ? "1 dia" : `${daysLeft} dias`;
  return wrap(`
  <tr><td style="text-align:center;padding-bottom:6px;"><span style="font-size:28px;">⏰</span></td></tr>
  <tr><td style="padding-bottom:16px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">
      ${firstName}, te ${daysLeft === 1 ? "queda 1 dia" : `quedan ${daysLeft} dias`} de prueba
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;">
    Tu plan en <strong>${restaurantName}</strong> vence en <strong>${dayLabel}</strong>. Si no renuevas, tu plan baja a Gratis y pierdes las funciones avanzadas.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Cómo renovar")}
    <div style="font-size:14px;color:#7a6547;line-height:1.8;">
      1. Entra a tu panel<br/>
      2. Ve a Suscripción<br/>
      3. Paga tu siguiente mes
    </div>
  `)}</td></tr>
  <tr><td style="padding-bottom:16px;">${btn(panelLink, "Ir a mi panel")}</td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">¿Dudas? Responde este email y te ayudamos.</td></tr>
  `);
}

export function trialExpiredEmailHtml(
  firstName: string, restaurantName: string, planesLink: string,
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

  return `<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>

<!-- Icon -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:16px">
  <table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td width="46" height="46" style="width:46px;height:46px;border-radius:50%;background:#f9f6f0;text-align:center;vertical-align:middle;font-size:24px;box-shadow:0 12px 30px rgba(120,80,20,0.12)">📋</td>
  </tr></table>
</td></tr>
</table>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 24px 70px rgba(70,45,10,0.10)">
<tr><td style="padding:28px 22px 24px">

<!-- Title -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:10px">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.12;letter-spacing:-0.03em;margin:0;color:#92400e">
  ${firstName}, tu prueba<br/>Premium terminó
</h1>
</td></tr>
</table>

<!-- Lead text -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:22px">
<p style="font-size:15px;color:#8a7550;line-height:1.55;margin:0">
  Tu prueba en <strong>${restaurantName}</strong> terminó, pero tu carta <strong>sigue activa</strong> en el plan Gratis.
</p>
</td></tr>
</table>

<!-- Plans section -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9f6f0;border:1px solid #ead7b7;border-radius:24px;margin-bottom:22px">
<tr><td style="padding:20px 18px 18px">
  <p style="font-size:13px;color:#836a47;margin:0 0 18px;text-align:center;line-height:1.5">Si quieres subir de plan, aquí tienes las opciones disponibles:</p>

  <!-- Gratis (actual) -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-bottom:13px;border-bottom:1px solid rgba(193,151,82,0.22);margin-bottom:13px;">
  <tr>
    <td style="vertical-align:top;padding-right:12px;">
      <p style="font-size:15px;margin:0 0 4px;font-weight:800;color:#888">Gratis <span style="display:inline-block;background:#92400e;color:#fff;font-size:9px;font-weight:900;padding:2px 7px;border-radius:99px;letter-spacing:0.06em;text-transform:uppercase;vertical-align:middle;margin-left:6px">Tu plan actual</span></p>
      <p style="margin:0;color:#836a47;font-size:13px;line-height:1.45">Carta QR · Genio IA · Panel · 2 vistas</p>
    </td>
    <td style="vertical-align:top;text-align:right;white-space:nowrap;">
      <p style="font-size:15px;font-weight:800;color:#8a7550;margin:0">$0</p>
    </td>
  </tr>
  </table>

  ${planRow("Silver", "$14.900", "#475569", "3 vistas · Dark/Light mode · Destacar platos · Ofertas")}
  ${planRow("Gold", "$29.900", "#92400e", "Estadísticas · Anuncios · Multilenguaje · Cross-selling")}
  ${planRow("Premium", "$49.900", "#6d28d9", "Stats avanzadas · Garzón · Clientes · Email marketing · Toteat", true)}
</td></tr>
</table>

<!-- CTA -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:8px">
  <a href="${planesLink}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:18px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;box-shadow:0 14px 26px rgba(242,154,0,0.28)">
    Ver mi suscripción →
  </a>
</td></tr>
</table>

</td></tr>
</table>

<!-- Contact footer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:24px">
<p style="color:#927955;font-size:12px;margin:0">
  ¿Necesitas ayuda? <a href="https://quierocomer.cl/#contacto" style="color:#f29a00;text-decoration:underline;font-weight:700">Contáctanos</a>
</p>
<p style="color:#b8a888;font-size:11px;margin:8px 0 0">QuieroComer.cl · ${new Date().getFullYear()}</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;
}
