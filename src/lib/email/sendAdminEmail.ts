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
export function welcomeOwnerEmailHtml(name: string, email: string, resetLink: string): string {
  return adminEmailTemplate(`
<h2 style="color:#FFD600;font-size:22px;margin-top:0;margin-bottom:16px;text-align:center">¡Bienvenido a QuieroComer!</h2>
<p style="color:#c0a060;font-size:16px;line-height:1.7;margin-bottom:16px">
  Hola ${name}, te creamos una cuenta para administrar tu local desde el panel de QuieroComer. Desde ahí vas a poder:
</p>
<ul style="color:#c0a060;font-size:15px;line-height:2;margin-bottom:20px;padding-left:20px">
  <li>Editar tu carta y platos</li>
  <li>Crear ofertas y promociones</li>
  <li>Ver cuánta gente escanea tu QR</li>
  <li>Gestionar llamados de garzón</li>
</ul>
<p style="color:#c0a060;font-size:14px;margin-bottom:20px">
  <strong>Tu email de acceso:</strong> ${email}
</p>
<p style="color:#c0a060;font-size:15px;line-height:1.7;margin-bottom:20px">
  Para empezar, configura tu contraseña tocando el botón:
</p>
<div style="text-align:center;margin-bottom:20px">
  <a href="${resetLink}" style="display:inline-block;background:#F4A623;color:#0D0D0D;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">
    Configurar mi contraseña
  </a>
</div>
<p style="color:#c0a060;font-size:15px;line-height:1.7;margin-bottom:6px">
  Después de eso, entra a tu panel en:
</p>
<p style="text-align:center;margin-bottom:20px">
  <a href="https://quierocomer.cl/panel" style="color:#FFD600;font-size:16px;font-weight:bold;text-decoration:none">quierocomer.cl/panel</a>
</p>
<p style="color:#5a4028;font-size:13px;line-height:1.6;margin-bottom:0">
  Este link expira en 1 hora. Si tienes dudas, responde este email o escríbenos a soporte@quierocomer.cl.
</p>`);
}
