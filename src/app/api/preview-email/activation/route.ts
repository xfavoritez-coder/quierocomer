import { NextResponse } from "next/server";

/**
 * GET /api/preview-email/activation
 * Preview the activation welcome email in browser.
 */
export async function GET() {
  const html = activationWelcomeEmailHtml({
    ownerName: "Daniel",
    restaurantName: "Sushi Master",
    panelLink: "https://quierocomer.cl/panel",
    qrLink: "https://quierocomer.cl/qr/sushi-master",
    credentials: { email: "dc_daniel_carrizo@hotmail.com", password: "sushi-master2026" },
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function activationWelcomeEmailHtml({
  ownerName,
  restaurantName,
  panelLink,
  qrLink,
  credentials,
}: {
  ownerName: string;
  restaurantName: string;
  panelLink: string;
  qrLink: string;
  credentials?: { email: string; password: string };
}): string {
  const initials = restaurantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return `<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;padding:32px 14px">
<tr><td>

<!-- Celebration header -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:24px">
  <p style="font-size:48px;margin:0;line-height:1">🎉</p>
</td></tr>
</table>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9f6f0;border-radius:20px;border:1px solid #e8dcc4">
<tr><td style="padding:32px 24px">

<!-- Welcome title -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:6px">
<h1 style="color:#1a1a1a;font-size:26px;margin:0;font-family:Georgia,serif;line-height:1.2">
  Bienvenido, ${ownerName}
</h1>
</td></tr>
<tr><td style="text-align:center;padding-bottom:24px">
<p style="color:#8a7550;font-size:16px;line-height:1.6;margin:0">
  <strong style="color:#e8930a">${restaurantName}</strong> ya está activo.<br/>Es hora de mostrarlo al mundo.
</p>
</td></tr>
</table>

<!-- Divider -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding-bottom:22px"><div style="width:40px;height:2px;background:#e8930a;margin:0 auto;border-radius:1px"></div></td></tr>
</table>

${credentials ? `
<!-- Credentials box -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #e8dcc4;border-radius:14px;margin-bottom:22px">
<tr><td style="padding:18px 20px">
  <p style="color:#92400e;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 12px">Tus datos de acceso</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="color:#8a7550;font-size:13px;padding:4px 0;width:90px;vertical-align:top">Email</td>
      <td style="color:#1a1a1a;font-size:13px;padding:4px 0;font-weight:700">${credentials.email}</td>
    </tr>
    <tr>
      <td style="color:#8a7550;font-size:13px;padding:4px 0;width:90px;vertical-align:top">Contraseña</td>
      <td style="color:#1a1a1a;font-size:13px;padding:4px 0;font-weight:700">${credentials.password}</td>
    </tr>
  </table>
  <p style="color:#b8a888;font-size:11px;margin:10px 0 0;line-height:1.4">Te recomendamos cambiarla en tu primer ingreso.</p>
</td></tr>
</table>
` : ""}

<!-- Steps -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #e8dcc4;border-radius:14px;margin-bottom:24px">
<tr><td style="padding:18px 20px">
  <p style="color:#92400e;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 14px">Tus próximos pasos</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:8px 0;vertical-align:top;width:32px">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:26px;height:26px;border-radius:50%;background:#e8930a;color:#fff;font-size:12px;font-weight:900;text-align:center;vertical-align:middle">1</td></tr></table>
    </td><td style="padding:8px 0;padding-left:10px;vertical-align:middle">
      <p style="color:#1a1a1a;font-size:14px;margin:0;font-weight:700">Sube tus fotos reales</p>
      <p style="color:#8a7550;font-size:13px;margin:2px 0 0">Desde tu panel puedes subir las fotos de tus platos</p>
    </td></tr>
    <tr><td style="padding:8px 0;vertical-align:top;width:32px">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:26px;height:26px;border-radius:50%;background:#e8930a;color:#fff;font-size:12px;font-weight:900;text-align:center;vertical-align:middle">2</td></tr></table>
    </td><td style="padding:8px 0;padding-left:10px;vertical-align:middle">
      <p style="color:#1a1a1a;font-size:14px;margin:0;font-weight:700">Revisa precios y descripciones</p>
      <p style="color:#8a7550;font-size:13px;margin:2px 0 0">Edita lo que necesites, los cambios se ven al instante</p>
    </td></tr>
    <tr><td style="padding:8px 0;vertical-align:top;width:32px">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:26px;height:26px;border-radius:50%;background:#e8930a;color:#fff;font-size:12px;font-weight:900;text-align:center;vertical-align:middle">3</td></tr></table>
    </td><td style="padding:8px 0;padding-left:10px;vertical-align:middle">
      <p style="color:#1a1a1a;font-size:14px;margin:0;font-weight:700">Imprime tu QR y ponlo en las mesas</p>
      <p style="color:#8a7550;font-size:13px;margin:2px 0 0">Descarga tu código QR desde el panel</p>
    </td></tr>
  </table>
</td></tr>
</table>

<!-- CTA buttons -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:10px">
  <a href="${panelLink}" style="display:block;background:#e8930a;color:#ffffff;font-size:16px;font-weight:900;padding:15px 0;border-radius:12px;text-decoration:none;letter-spacing:0.3px;font-family:Georgia,serif;text-align:center;max-width:300px;margin:0 auto">
    Entrar a mi panel →
  </a>
</td></tr>
<tr><td style="text-align:center;padding-bottom:20px">
  <a href="${qrLink}" style="display:block;background:transparent;color:#8a7550;font-size:14px;font-weight:700;padding:12px 0;border-radius:12px;text-decoration:none;border:2px solid #e8dcc4;font-family:Georgia,serif;text-align:center;max-width:300px;margin:0 auto">
    Ver mi carta digital
  </a>
</td></tr>
</table>

<!-- Support -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e8dcc4">
<tr><td style="padding-top:18px;text-align:center">
  <p style="color:#b8a888;font-size:13px;line-height:1.55;margin:0">
    ¿Necesitas ayuda? <a href="https://quierocomer.cl/#contacto" style="color:#e8930a;text-decoration:underline">Contáctanos</a>
  </p>
</td></tr>
</table>

</td></tr>
</table>

<!-- Footer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:28px">
<p style="color:#b8a888;font-size:12px;margin:0">QuieroComer.cl · 2026</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;
}
