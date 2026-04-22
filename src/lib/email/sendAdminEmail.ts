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
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    // Log success
    await prisma.emailLog.create({
      data: { to, subject, purpose, status: "sent" },
    }).catch(() => {}); // don't fail if log insert fails
    return result;
  } catch (err) {
    // Log failure
    const errorMsg = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.create({
      data: { to, subject, purpose, status: "failed", errorMsg },
    }).catch(() => {});
    throw err; // re-throw so caller can handle
  }
}

/** Wrap content in the branded admin email template */
export function adminEmailTemplate(content: string): string {
  return `<html><body style="background-color:#0D0D0D;font-family:Georgia,serif;margin:0;padding:0">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<div style="text-align:center;margin-bottom:32px">
<p style="font-size:28px;margin:0 0 8px">🧞</p>
<h1 style="color:#FFD600;font-size:20px;letter-spacing:0.3em;text-transform:uppercase;margin:0">QuieroComer</h1>
</div>
<div style="background-color:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:40px 32px">
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
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:20px;text-align:center">¡Todo listo, ${name}! 🎉</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:24px">
  Tu carta digital ya está funcionando. Te dejamos tus datos de acceso y 3 pasos rápidos para que quede todo perfecto.
</p>

<div style="background:rgba(244,166,35,0.1);border:1px solid rgba(244,166,35,0.2);border-radius:12px;padding:20px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Tus datos de acceso</p>
  <p style="color:#c0a060;font-size:15px;margin:0 0 4px"><strong>Email:</strong> ${email}</p>
  <p style="color:#c0a060;font-size:15px;margin:0"><strong>Contraseña:</strong> ${password}</p>
</div>

<div style="margin-bottom:24px">
  <div style="display:flex;align-items:flex-start;margin-bottom:18px">
    <span style="background:#F4A623;color:#0D0D0D;font-size:14px;font-weight:bold;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px">1</span>
    <div>
      <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0"><strong style="color:#FFD600">Revisa tu carta</strong><br>Mira cómo se ve tu menú desde el celular${qrLink ? ` en <a href="${qrLink}" style="color:#FFD600;text-decoration:underline">${qrLink.replace("https://", "")}</a>` : ""}.</p>
    </div>
  </div>
  <div style="display:flex;align-items:flex-start;margin-bottom:18px">
    <span style="background:#F4A623;color:#0D0D0D;font-size:14px;font-weight:bold;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px">2</span>
    <div>
      <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0"><strong style="color:#FFD600">Ajusta lo que necesites</strong><br>Entra a tu panel, revisa los productos, precios y fotos. Corrige lo que haga falta.</p>
    </div>
  </div>
  <div style="display:flex;align-items:flex-start">
    <span style="background:#F4A623;color:#0D0D0D;font-size:14px;font-weight:bold;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px">3</span>
    <div>
      <p style="color:#c0a060;font-size:15px;line-height:1.6;margin:0"><strong style="color:#FFD600">Imprime tu QR y ponlo en las mesas</strong><br>Desde tu panel puedes generar e imprimir el código QR. Ponlo en cada mesa y listo.</p>
    </div>
  </div>
</div>

<div style="text-align:center;margin-bottom:20px">
  <a href="${panelLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Entrar a mi panel →
  </a>
</div>
<p style="color:#5a4028;font-size:13px;line-height:1.6;margin-bottom:0;text-align:center">
  Si tienes dudas, responde este email o escríbenos a soporte@quierocomer.cl
</p>`);
}
