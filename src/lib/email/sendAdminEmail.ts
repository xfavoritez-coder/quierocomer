import { resend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";

const FROM = process.env.FROM_EMAIL
  ? `QuieroComer <${process.env.FROM_EMAIL}>`
  : "QuieroComer <onboarding@resend.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  purpose?: string; // password_reset, welcome, etc.
}

export async function sendAdminEmail({ to, subject, html, purpose = "other" }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

    if (error) {
      const errorMsg = error.message || JSON.stringify(error);
      console.error("Resend error:", errorMsg);
      await prisma.emailLog.create({
        data: { to, subject, purpose, status: "failed", errorMsg },
      }).catch(() => {});
      throw new Error(errorMsg);
    }

    // Log success
    await prisma.emailLog.create({
      data: { to, subject, purpose, status: "sent" },
    }).catch(() => {});
    return data;
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith("Resend"))) {
      // Only log if not already logged above
      const errorMsg = err instanceof Error ? err.message : String(err);
      await prisma.emailLog.create({
        data: { to, subject, purpose, status: "failed", errorMsg },
      }).catch(() => {});
    }
    throw err;
  }
}

/** Wrap content in the branded admin email template */
export function adminEmailTemplate(content: string): string {
  return `<html><body style="background-color:#0D0D0D;font-family:Georgia,serif;margin:0;padding:0">
<div style="max-width:640px;margin:0 auto;padding:40px 16px">
<div style="text-align:center;margin-bottom:16px">
<p style="font-size:32px;margin:0">🧞</p>
</div>
<div style="background-color:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:36px 36px">
${content}
</div>
<div style="text-align:center;margin-top:32px">
<p style="color:#5a4028;font-size:12px">Hecho con 💛 y mucha hambre · QuieroComer.cl</p>
</div>
</div></body></html>`;
}

/** Password reset email */
export function resetPasswordEmailHtml(name: string, resetLink: string): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:16px;text-align:center">Recuperar contraseña</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px">
  Hola ${name}, recibiste este email porque solicitaste recuperar tu contraseña del panel de QuieroComer.
  Si no fuiste tú, ignora este mensaje.
</p>
<div style="text-align:center;margin-bottom:24px">
  <a href="${resetLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Restablecer contraseña
  </a>
</div>
<p style="color:#5a4028;font-size:13px;line-height:1.6;margin-bottom:0">
  Este link expira en 1 hora. Si no hace efecto, solicita uno nuevo desde el panel.
</p>`);
}

/** Welcome email for new owners */
export function welcomeOwnerEmailHtml(name: string, email: string, password: string, qrLink: string | null, panelLink: string): string {
  const step = (n: number, title: string, body: string) => `
<div style="margin-bottom:28px">
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px"><tr>
    <td width="38" valign="top" style="padding-top:1px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="28" height="28" style="background:#F4A623;color:#0D0D0D;font-size:14px;font-weight:bold;text-align:center;border-radius:50%;line-height:28px">${n}</td>
      </tr></table>
    </td>
    <td valign="top" style="color:#FFD600;font-size:15px;font-weight:bold">${title}</td>
  </tr></table>
  <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0">${body}</p>
</div>`;

  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:28px;text-align:center">¡Todo listo, ${name}! 🎉</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px">
  Tu carta QR ya está funcionando. Solo debes seguir los 3 siguientes pasos para dejar todo listo y comenzar a aumentar tus ventas.
</p>

${step(1, "Revisa tu carta", `Mira cómo se ve tu menú y que esté todo bien en${qrLink ? ` <a href="${qrLink}" style="color:#FFD600;text-decoration:underline">${qrLink.replace("https://", "")}</a>` : " tu link QR"}.`)}

<div style="margin-bottom:28px">
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px"><tr>
    <td width="38" valign="top" style="padding-top:1px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="28" height="28" style="background:#F4A623;color:#0D0D0D;font-size:14px;font-weight:bold;text-align:center;border-radius:50%;line-height:28px">2</td>
      </tr></table>
    </td>
    <td valign="top" style="color:#FFD600;font-size:15px;font-weight:bold">Ajusta lo que necesites</td>
  </tr></table>
  <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 12px">Entra a tu panel con los siguientes accesos y corrige lo que haga falta.</p>
  <div style="background:#3a2210;border:1px solid #5a3a18;border-radius:12px;padding:16px 18px">
    <p style="color:#FFD600;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px">Tus datos de acceso</p>
    <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Email:</strong> ${email}</p>
    <p style="color:#c0a060;font-size:15px;margin:0"><strong>Contraseña:</strong> ${password}</p>
  </div>
</div>

${step(3, "Imprime tu QR y ponlo en las mesas", "Desde tu panel puedes generar e imprimir el código QR. Ponlo en cada mesa y listo.")}

<div style="background:#3a2210;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px">🎁 Bonus</p>
  <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0">
    Estás en el plan <strong>Gratis</strong>. Cuando quieras, prueba <strong>7 días gratis</strong> el plan Gold o Premium para desbloquear estadísticas, ofertas, multilenguaje y más. Sin compromiso. Cancelas cuando quieras.
  </p>
</div>

<div style="text-align:center">
  <a href="${panelLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Entrar a mi panel →
  </a>
</div>`);
}

/**
 * Email de entrega al dueño con trial activo. Le explica que tiene N dias
 * gratis para inscribir su tarjeta y mantener el plan pagado.
 */
export function handoffOwnerEmailHtml(
  name: string,
  email: string,
  password: string,
  qrLink: string | null,
  panelLink: string,
  planLabel: string,
  trialDays: number,
): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:20px;text-align:center">¡Bienvenido, ${name}! 🎉</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:20px">
  Tu carta digital ya está funcionando. Te activamos el plan <strong style="color:#FFD600">${planLabel}</strong> con <strong style="color:#FFD600">${trialDays} días gratis</strong> para que la pruebes con tus clientes reales.
</p>

<div style="background:#3a2210;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">🔑 Tu acceso al panel</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Email:</strong> ${email}</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 12px"><strong>Contraseña:</strong> ${password}</p>
  <p style="color:#c0a060;font-size:13px;margin:0;opacity:0.85">Te pediremos cambiarla en el primer login.</p>
</div>

<div style="background:#2a1a08;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">⏰ Para no perder tu plan</p>
  <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0 0 8px">
    Tienes <strong style="color:#FFD600">${trialDays} días</strong> para inscribir tu tarjeta y completar tus datos de facturación. Después de eso, el cobro mensual se hace automático.
  </p>
  <p style="color:#c0a060;font-size:14px;line-height:1.6;margin:0;opacity:0.85">
    Si no inscribes tarjeta en ${trialDays} días, tu plan baja a Gratis (la carta sigue funcionando, pero pierdes funciones avanzadas).
  </p>
</div>

<div style="text-align:center;margin-top:24px;display:flex;flex-direction:column;gap:12px">
  ${qrLink ? `<a href="${qrLink}" style="display:inline-block;background:#FFD600;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;margin-bottom:10px">
    Ver mi carta digital →
  </a>` : ""}
  <a href="${panelLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Entrar a mi panel →
  </a>
</div>`);
}

/**
 * Email de entrega para locales en plan FREE. Sin info de trial ni
 * urgencia — solo bienvenida con credenciales y enlaces.
 */
export function handoffFreeEmailHtml(
  name: string,
  email: string,
  password: string,
  qrLink: string,
  panelLink: string,
  restaurantName: string,
): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:20px;text-align:center">¡Bienvenido, ${name}! 🎉</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:20px">
  Tu carta digital de <strong style="color:#FFD600">${restaurantName}</strong> ya está lista. Tus clientes la van a poder ver escaneando el código QR.
</p>

<div style="background:#3a2210;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">🔑 Tu acceso al panel</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Email:</strong> ${email}</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 12px"><strong>Contraseña:</strong> ${password}</p>
  <p style="color:#c0a060;font-size:13px;margin:0;opacity:0.85">Te pediremos cambiarla en el primer login.</p>
</div>

<p style="color:#c0a060;font-size:14px;line-height:1.6;margin-bottom:24px">
  Estás en el plan <strong style="color:#FFD600">Gratis</strong>. Cuando quieras, desde el panel puedes probar 7 días gratis los planes Gold o Premium para desbloquear estadísticas, ofertas, multilenguaje y mucho más.
</p>

<div style="text-align:center;margin-top:24px">
  <a href="${qrLink}" style="display:inline-block;background:#FFD600;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;margin-bottom:10px">
    Ver mi carta digital →
  </a>
</div>
<div style="text-align:center;margin-top:6px">
  <a href="${panelLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Entrar a mi panel →
  </a>
</div>`);
}

/**
 * Email al dueño cuando activa un plan pago desde /activar (pago exitoso).
 */
export function planActivatedEmailHtml(
  firstName: string,
  restaurantName: string,
  planLabel: string,
  amountPaid: string,
  nextChargeDate: string,
  nextChargeAmount: string,
  panelLink: string,
  qrLink: string,
): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:20px;text-align:center">¡Plan ${planLabel} activado! 🎉</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:20px">
  ${firstName}, tu carta de <strong style="color:#FFD600">${restaurantName}</strong> ya está funcionando con el plan <strong style="color:#FFD600">${planLabel}</strong>.
</p>

<div style="background:#3a2210;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">💳 Detalle del pago</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Cobrado hoy:</strong> ${amountPaid}</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Próximo cobro:</strong> ${nextChargeDate}</p>
  <p style="color:#c0a060;font-size:15px;margin:0"><strong>Monto mensual:</strong> ${nextChargeAmount}</p>
</div>

<div style="background:#2a1a08;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Próximos pasos</p>
  <ol style="color:#c0a060;font-size:14px;line-height:1.8;margin:0 0 0 18px;padding:0">
    <li>Sube tus fotos reales desde el panel</li>
    <li>Personaliza precios, descripciones y categorías</li>
    <li>Imprime tu código QR y ponlo en las mesas</li>
  </ol>
</div>

<div style="text-align:center;margin-top:24px">
  <a href="${panelLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;margin-bottom:10px">
    Entrar a mi panel →
  </a>
</div>
<div style="text-align:center;margin-top:8px">
  <a href="${qrLink}" style="color:#FFD600;font-size:14px;text-decoration:underline">Ver mi carta digital</a>
</div>

<p style="color:#c0a060;font-size:13px;line-height:1.6;margin:20px 0 0;text-align:center;opacity:0.8">
  Puedes cancelar o cambiar de plan cuando quieras desde tu panel.<br>¿Dudas? Responde este email.
</p>`);
}

/**
 * Email al dueño cuando activa el plan gratis desde /activar.
 */
export function freeActivatedEmailHtml(
  firstName: string,
  restaurantName: string,
  panelLink: string,
  qrLink: string,
  credentials?: { email: string; password: string },
): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:20px;text-align:center">¡Tu carta está activa! 🎉</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:20px">
  ${firstName}, tu carta de <strong style="color:#FFD600">${restaurantName}</strong> ya está lista para que tus clientes la escaneen.
</p>

${credentials ? `
<div style="background:#1a1a2e;border:1px solid #3a3a5a;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px">Tus datos de acceso al panel</p>
  <p style="color:#c0a060;font-size:14px;margin:0 0 6px"><strong style="color:#e0d0b0">Email:</strong> ${credentials.email}</p>
  <p style="color:#c0a060;font-size:14px;margin:0"><strong style="color:#e0d0b0">Contraseña:</strong> ${credentials.password}</p>
</div>
` : ""}

<div style="background:#2a1a08;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Próximos pasos</p>
  <ol style="color:#c0a060;font-size:14px;line-height:1.8;margin:0 0 0 18px;padding:0">
    <li>Sube tus fotos reales desde el panel</li>
    <li>Personaliza precios, descripciones y categorías</li>
    <li>Imprime tu código QR y ponlo en las mesas</li>
  </ol>
</div>

<div style="text-align:center;margin-top:24px">
  <a href="${panelLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;margin-bottom:10px">
    Entrar a mi panel →
  </a>
</div>
<div style="text-align:center;margin-top:8px">
  <a href="${qrLink}" style="color:#FFD600;font-size:14px;text-decoration:underline">Ver mi carta digital</a>
</div>

<p style="color:#c0a060;font-size:13px;line-height:1.6;margin:20px 0 0;text-align:center;opacity:0.8">
  Estás en el plan Gratis. Cuando quieras más, activa Premium desde tu panel.
</p>`);
}

/**
 * Email interno al admin cuando un restaurante activa un plan.
 */
export function adminNewActivationEmailHtml(
  restaurantName: string,
  planLabel: string,
  amountCharged: string,
  ownerEmail: string,
  slug: string,
): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:16px;text-align:center">Nuevo cliente activó ${planLabel}</h2>
<div style="background:#3a2210;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:20px">
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Restaurant:</strong> <span style="color:#FFD600">${restaurantName}</span></p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Plan:</strong> ${planLabel}</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Cobrado:</strong> ${amountCharged}</p>
  <p style="color:#c0a060;font-size:15px;margin:0"><strong>Email dueño:</strong> ${ownerEmail}</p>
</div>
<div style="text-align:center">
  <a href="https://quierocomer.cl/qr/${slug}" style="color:#FFD600;font-size:14px;text-decoration:underline">Ver carta</a>
  &nbsp;·&nbsp;
  <a href="https://quierocomer.cl/admin/funnel" style="color:#FFD600;font-size:14px;text-decoration:underline">Ver funnel</a>
</div>`);
}

/**
 * Email recordatorio cuando el trial está por vencer (≤ 2 días).
 * Se manda una sola vez (cron usa trialReminderSentAt para no duplicar).
 */
export function trialEndingSoonEmailHtml(
  firstName: string,
  restaurantName: string,
  daysLeft: number,
  panelLink: string,
  facturacionLink: string,
): string {
  const dayLabel = daysLeft === 1 ? "1 día" : `${daysLeft} días`;
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:16px">⏰ ${firstName}, ${daysLeft === 1 ? "te queda 1 día" : `quedan ${daysLeft} días`} de prueba</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:20px">
  Tu plan en <strong style="color:#FFD600">${restaurantName}</strong> vence en <strong style="color:#FFD600">${dayLabel}</strong>. Si no inscribes tu tarjeta antes, tu plan baja a Gratis y pierdes las funciones avanzadas (estadísticas, ofertas, multilenguaje, etc.).
</p>

<div style="background:#2a1a08;border:1px solid #5a3a18;border-radius:12px;padding:18px 20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Cómo evitarlo</p>
  <ol style="color:#c0a060;font-size:14px;line-height:1.7;margin:0 0 0 18px;padding:0">
    <li>Completa tus datos de facturación (RUT, razón social)</li>
    <li>Inscribe tu tarjeta en Webpay (1 sola vez)</li>
    <li>Listo — el cobro mensual sale automático</li>
  </ol>
</div>

<div style="text-align:center;margin-top:24px">
  <a href="${facturacionLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Inscribir tarjeta ahora →
  </a>
</div>

<p style="color:#c0a060;font-size:13px;line-height:1.6;margin:20px 0 0;text-align:center;opacity:0.8">
  ¿Dudas? Responde este email y te ayudamos.
</p>`);
}
