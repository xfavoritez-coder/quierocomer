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
