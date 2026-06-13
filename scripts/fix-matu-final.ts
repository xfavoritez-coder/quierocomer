import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const p = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL ? `QuieroComer <${process.env.FROM_EMAIL}>` : "QuieroComer <onboarding@resend.dev>";

async function main() {
  // Fix email in DB - update from any wrong version to the correct one
  const r1 = await p.restaurantOwner.updateMany({
    where: { OR: [
      { email: 'juanmaturanancalada@gmail.com' },
      { email: 'juanmaturaanancalada@gmail.com' },
    ]},
    data: { email: 'juanmaturanaencalada@gmail.com' },
  });
  console.log('Updated owner emails:', r1.count);

  // Send email
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: 'juanmaturanaencalada@gmail.com',
    subject: 'Juan, tu panel de Don Matu esta listo',
    html: `<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:0">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px"><tr><td>
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="text-align:center;padding-bottom:16px">
<table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="46" height="46" style="width:46px;height:46px;border-radius:50%;background:#fff;text-align:center;vertical-align:middle;font-size:24px;box-shadow:0 12px 30px rgba(120,80,20,.12)">&#127881;</td></tr></table>
</td></tr></table>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 24px 70px rgba(70,45,10,.10)"><tr><td style="padding:28px 22px 24px">

<h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.08;letter-spacing:-0.03em;margin:0 0 10px;color:#111;text-align:center">Don Matu<br/>Tu panel esta listo</h1>
<p style="font-size:15px;color:#7a6547;line-height:1.55;margin:0 0 10px;text-align:center">Juan, tu carta de Don Matu ya esta creada. Entra a tu panel para revisarla, editarla y dejarla a tu gusto.</p>
<p style="font-size:13px;color:#a08a68;line-height:1.5;margin:0 0 22px;text-align:center">Tu carta es privada — nadie la ve hasta que tu compartas el QR en tus mesas.</p>

<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:12px"><a href="https://quierocomer.cl/api/panel/demo-auth?slug=don-matu" style="display:block;background:#f7a400;color:#fff;font-size:16px;font-weight:800;padding:18px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;box-shadow:0 14px 26px rgba(242,154,0,.28)">Entrar a mi panel →</a></td></tr>
<tr><td style="text-align:center;padding-bottom:22px"><a href="https://quierocomer.cl/qr/don-matu" style="display:block;background:#fffaf1;color:#6c4d22;font-size:16px;font-weight:800;padding:16px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;border:1px solid #ead7b7">Ver como se ve mi carta</a></td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #ead7b7;border-radius:22px;margin-bottom:22px"><tr><td style="padding:22px 20px">
<p style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:800;color:#92400e;margin:0 0 16px;text-align:center">&#128272; Tus datos de acceso</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px"><tr><td style="padding:12px 14px"><p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Email</p><p style="font-size:14px;color:#111;font-weight:700;margin:0">juanmaturanaencalada@gmail.com</p></td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px"><tr><td style="padding:12px 14px"><p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Contrasena</p><p style="font-size:14px;color:#111;font-weight:700;margin:0;font-family:monospace">don-matu2026</p></td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px"><tr><td style="padding:12px 14px"><p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Tu carta</p><a href="https://quierocomer.cl/qr/don-matu" style="font-size:14px;color:#e8930a;font-weight:700;text-decoration:none">quierocomer.cl/qr/don-matu</a></td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:12px"><tr><td style="padding:12px 14px"><p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Tu panel</p><a href="https://quierocomer.cl/panel" style="font-size:14px;color:#e8930a;font-weight:700;text-decoration:none">quierocomer.cl/panel</a></td></tr></table>
<p style="color:#8a724f;font-size:11px;margin:0;text-align:center">Te recomendamos cambiar la contrasena en tu primer ingreso.</p>
</td></tr></table>

<p style="color:#927955;font-size:12px;text-align:center;margin:0">Tu carta ya esta creada. Editala a tu gusto y comparte el QR cuando estes listo.</p>
</td></tr></table>

<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="text-align:center;padding-top:24px">
<p style="color:#927955;font-size:12px;margin:0">Necesitas ayuda? <a href="https://quierocomer.cl/#contacto" style="color:#f29a00;text-decoration:underline;font-weight:700">Contactanos</a></p>
<p style="color:#b8a888;font-size:11px;margin:8px 0 0">QuieroComer.cl · 2026</p>
</td></tr></table>
</td></tr></table></body></html>`,
  });

  if (error) { console.error('Error:', error); process.exit(1); }
  console.log('Email sent:', data?.id);

  await p.emailLog.create({
    data: { to: 'juanmaturanaencalada@gmail.com', subject: 'Juan, tu panel de Don Matu esta listo', purpose: 'activation_welcome', status: 'sent' },
  });
  console.log('Done');
  await p.$disconnect();
}
main();
