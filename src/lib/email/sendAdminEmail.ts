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
    <div style="font-size:14px;color:#7a6547;line-height:1.6;">Inscribe tu tarjeta antes de que terminen los ${trialDays} dias. Si no lo haces, tu plan baja a Gratis.</div>
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
    ${field("Proximo cobro", nextChargeDate)}
    ${field("Monto mensual", nextChargeAmount)}
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
    Tu plan en <strong>${restaurantName}</strong> vence en <strong>${dayLabel}</strong>. Si no inscribes tu tarjeta, tu plan baja a Gratis y pierdes las funciones avanzadas.
  </td></tr>
  <tr><td style="padding-bottom:16px;">${card(`
    ${label("Como evitarlo")}
    <div style="font-size:14px;color:#7a6547;line-height:1.8;">
      1. Completa tus datos de facturacion<br/>
      2. Inscribe tu tarjeta (1 sola vez)<br/>
      3. Listo — el cobro mensual sale automatico
    </div>
  `)}</td></tr>
  <tr><td style="padding-bottom:16px;">${btn(facturacionLink, "Inscribir tarjeta ahora")}</td></tr>
  <tr><td style="font-size:12px;color:#b8a888;text-align:center;">¿Dudas? Responde este email y te ayudamos.</td></tr>
  `);
}
