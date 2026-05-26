import { NextResponse } from "next/server";

/**
 * GET /api/preview-email/activation
 * Preview the activation welcome email in browser.
 */
export async function GET() {
  const html = activationWelcomeEmailHtml({
    ownerName: "Daniel",
    restaurantName: "Sushi Master",
    panelLink: "https://quierocomer.cl/api/panel/demo-auth?slug=sushi-master",
    qrLink: "https://quierocomer.cl/qr/sushi-master",
    credentials: { email: "dc_daniel_carrizo@hotmail.com", password: "sushi-master2026" },
    planLabel: "Premium (14 dias gratis)",
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function activationWelcomeEmailHtml({
  ownerName,
  restaurantName,
  panelLink,
  qrLink,
  credentials,
  planLabel,
}: {
  ownerName: string;
  restaurantName: string;
  panelLink: string;
  qrLink: string;
  credentials?: { email: string; password: string };
  planLabel?: string;
}): string {

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
    <td width="46" height="46" style="width:46px;height:46px;border-radius:50%;background:#ffffff;text-align:center;vertical-align:middle;font-size:24px;box-shadow:0 12px 30px rgba(120,80,20,0.12)">🎉</td>
  </tr></table>
</td></tr>
</table>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 24px 70px rgba(70,45,10,0.10)">
<tr><td style="padding:28px 22px 24px">

<!-- Title -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:10px">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.08;letter-spacing:-0.03em;margin:0;color:#111111">
  ${restaurantName}<br/>Tu panel está listo
</h1>
</td></tr>
</table>

<!-- Lead text -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:22px">
<p style="font-size:15px;color:#7a6547;line-height:1.55;margin:0">
  ${ownerName}, tu carta de ${restaurantName} ya está creada. Entra a tu panel para revisarla, editarla y dejarla a tu gusto.
</p>
<p style="font-size:13px;color:#a08a68;line-height:1.5;margin:10px 0 0">
  Tu carta es privada — nadie la ve hasta que tú compartas el QR en tus mesas.
</p>
</td></tr>
</table>

<!-- Primary CTA: Panel -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:12px">
  <a href="${panelLink}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:18px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;box-shadow:0 14px 26px rgba(242,154,0,0.28)">
    Entrar a mi panel →
  </a>
</td></tr>
<tr><td style="text-align:center;padding-bottom:8px">
  <a href="${qrLink}" style="display:block;background:#fffaf1;color:#6c4d22;font-size:16px;font-weight:800;padding:16px 0;border-radius:17px;text-decoration:none;text-align:center;max-width:340px;margin:0 auto;border:1px solid #ead7b7">
    Ver cómo se ve mi carta
  </a>
</td></tr>
<tr><td style="padding-bottom:22px"></td></tr>
</table>

<!-- Gift banner -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5eef8;border:1px solid #d8b4fe;border-radius:18px;margin-bottom:22px">
<tr><td style="padding:18px 18px;text-align:center">
  <p style="font-size:20px;margin:0 0 6px">🎁</p>
  <p style="font-size:15px;font-weight:800;color:#7c3aed;margin:0 0 6px">Te regalamos 14 dias de Premium</p>
  <p style="font-size:13px;color:#6b5b8a;line-height:1.5;margin:0">Todas las funciones avanzadas disponibles. Al terminar, tu carta seguirá activa en el plan Gratis.</p>
</td></tr>
</table>

${credentials ? `
<!-- Credentials card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #ead7b7;border-radius:22px;margin-bottom:22px">
<tr><td style="padding:22px 20px">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="text-align:center;padding-bottom:14px">
      <span style="font-size:22px">🔐</span>
    </td></tr>
    <tr><td style="text-align:center;padding-bottom:16px">
      <p style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:800;color:#92400e;margin:0">Tus datos de acceso</p>
    </td></tr>
  </table>

  <!-- Email -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px">
  <tr>
    <td style="padding:12px 14px">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Email</p>
      <p style="font-size:14px;color:#111;font-weight:700;margin:0;word-break:break-word">${credentials.email}</p>
    </td>
  </tr>
  </table>

  <!-- Password -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:8px">
  <tr>
    <td style="padding:12px 14px">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Contraseña</p>
      <p style="font-size:14px;color:#111;font-weight:700;margin:0;font-family:monospace,sans-serif;letter-spacing:0.5px">${credentials.password}</p>
    </td>
  </tr>
  </table>

  <!-- Public link -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffaf1;border:1px solid #ead7b7;border-radius:12px;margin-bottom:12px">
  <tr>
    <td style="padding:12px 14px">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;color:#92400e;margin:0 0 4px">Tu carta</p>
      <a href="${qrLink}" style="font-size:14px;color:#e8930a;font-weight:700;text-decoration:none;word-break:break-word">${qrLink}</a>
    </td>
  </tr>
  </table>

  <p style="color:#8a724f;font-size:11px;margin:0;line-height:1.45;text-align:center">Te recomendamos cambiar la contraseña en tu primer ingreso al panel.</p>
</td></tr>
</table>
` : ""}

<!-- Steps card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:rgba(255,255,255,0.44);border:1px solid #ead7b7;border-radius:24px">
<tr><td style="padding:20px 18px 18px">
  <p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:900;color:#e78d00;margin:0 0 18px;text-align:center">Próximos pasos</p>

  <!-- Step 1 -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-bottom:13px">
  <tr>
    <td style="width:40px;vertical-align:top;padding-top:2px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="30" height="30" style="width:30px;height:30px;border-radius:50%;background:#f29a00;color:#fff;font-weight:900;font-size:13px;text-align:center;vertical-align:middle">1</td>
      </tr></table>
    </td>
    <td style="vertical-align:top;padding-left:4px">
      <p style="font-size:15px;margin:0 0 4px;font-weight:800;color:#111">Revisa y corrige tus platos</p>
      <p style="margin:0;color:#836a47;font-size:13px;line-height:1.45">Ajusta nombres, precios y descripciones desde tu panel.</p>
    </td>
  </tr>
  </table>

  <!-- Step 2 -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:13px 0;border-top:1px solid rgba(193,151,82,0.22)">
  <tr>
    <td style="width:40px;vertical-align:top;padding-top:2px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="30" height="30" style="width:30px;height:30px;border-radius:50%;background:#f29a00;color:#fff;font-weight:900;font-size:13px;text-align:center;vertical-align:middle">2</td>
      </tr></table>
    </td>
    <td style="vertical-align:top;padding-left:4px">
      <p style="font-size:15px;margin:0 0 4px;font-weight:800;color:#111">Sube tus fotos reales</p>
      <p style="margin:0;color:#836a47;font-size:13px;line-height:1.45">Reemplaza las fotos de referencia con fotos de tus platos.</p>
    </td>
  </tr>
  </table>

  <!-- Step 3 -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-top:13px;border-top:1px solid rgba(193,151,82,0.22)">
  <tr>
    <td style="width:40px;vertical-align:top;padding-top:2px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="30" height="30" style="width:30px;height:30px;border-radius:50%;background:#f29a00;color:#fff;font-weight:900;font-size:13px;text-align:center;vertical-align:middle">3</td>
      </tr></table>
    </td>
    <td style="vertical-align:top;padding-left:4px">
      <p style="font-size:15px;margin:0 0 4px;font-weight:800;color:#111">Comparte tu QR cuando estés listo</p>
      <p style="margin:0;color:#836a47;font-size:13px;line-height:1.45">Descarga e imprime el código QR para las mesas de tu local.</p>
    </td>
  </tr>
  </table>

</td></tr>
</table>

<!-- Footer note -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding:18px 8px 0">
<p style="color:#927955;font-size:12px;line-height:1.5;margin:0">
  Tu carta ya está creada. Edítala a tu gusto y comparte el QR cuando estés listo.
</p>
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
<p style="color:#b8a888;font-size:11px;margin:8px 0 0">QuieroComer.cl · 2026</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;
}
