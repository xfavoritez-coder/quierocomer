import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const GOLD = "#e8930a";
const BASE_URL = "https://quierocomer.com";

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
    <a href="${BASE_URL}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.com</a>
    <br/><span style="font-size:10px;color:#ccc;">&copy; ${new Date().getFullYear()}</span>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

const FROM = process.env.FROM_EMAIL
  ? `QuieroComer <${process.env.FROM_EMAIL}>`
  : "QuieroComer <onboarding@resend.dev>";

async function main() {
  const html = wrap(`
  <tr><td style="padding-bottom:16px;">
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;">
      Matias, falta un paso para tu carta
    </h1>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;">
    Intentamos crear la carta digital de <strong>Chicken Litu</strong>, pero no pudimos acceder al archivo de Google Drive que subiste. Esto pasa cuando el archivo tiene acceso restringido.
  </td></tr>
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Cómo solucionarlo</div>
        <div style="font-size:14px;color:#7a6547;line-height:1.8;">
          1. Abre tu archivo en Google Drive<br/>
          2. Haz clic en <strong>Compartir</strong> (arriba a la derecha)<br/>
          3. En "Acceso general", cambia de <em>Restringido</em> a <strong>Cualquier persona con el enlace</strong><br/>
          4. Haz clic en <strong>Listo</strong>
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Una vez que cambies los permisos, nosotros nos encargamos del resto. Tu carta estara lista en minutos.
  </td></tr>
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbf3;border:1px solid ${GOLD}33;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:10px;color:${GOLD};font-weight:800;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Opción más fácil</div>
        <div style="font-size:14px;color:#7a6547;line-height:1.7;">
          Si prefieres algo más rápido, puedes <strong>sacarle una foto a tu carta</strong> y subirla directamente. Aceptamos fotos en JPG o PNG y nuestro sistema las procesa automáticamente.
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding-bottom:16px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0;">
      <a href="https://quierocomer.com" style="display:inline-block;background:${GOLD};color:#fff;font-size:15px;font-weight:800;padding:14px 32px;border-radius:14px;text-decoration:none;">Volver a subir mi carta</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="font-size:13px;color:#b8a888;text-align:center;line-height:1.6;">
    Si tienes dudas, simplemente responde este email y te ayudamos.
  </td></tr>
  `);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: "mrojassoto15@gmail.com",
    subject: "Matias, tu carta de Chicken Litu está casi lista (v2)",
    html,
  });

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log("Email sent! ID:", data?.id);

  // Log it
  await prisma.emailLog.create({
    data: {
      to: "mrojassoto15@gmail.com",
      subject: "Matias, tu carta de Chicken Litu está casi lista (v2)",
      purpose: "lead_gdrive_fix",
      status: "sent",
    },
  });

  // Add event to lead
  const lead = await prisma.lead.findFirst({
    where: { localName: "CHICKENLITU" },
  });
  if (lead) {
    const events = (lead.events as any[]) || [];
    events.push({
      ts: new Date().toISOString(),
      action: "manual_email_gdrive_permisos",
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { events },
    });
    console.log("Lead events updated");
  }

  await prisma.$disconnect();
}

main();
