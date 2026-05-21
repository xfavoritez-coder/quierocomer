/**
 * Email que se envía al dueño cuando su carta está lista para ver.
 * Diseño acorde al branding de QuieroComer (dark + amber/gold).
 * Usa wrapper propio (no adminEmailTemplate) para mejor responsive en mobile.
 */
export function cartaReadyEmailHtml({
  ownerName,
  restaurantName,
  logoUrl,
  dishCount,
  clickUrl,
  openPixel,
  activarUrl,
}: {
  ownerName: string;
  restaurantName: string;
  logoUrl: string | null;
  dishCount: number;
  clickUrl: string;
  openPixel: string;
  activarUrl: string;
}): string {
  const initials = restaurantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return `<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#0D0D0D;font-family:Georgia,serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<div style="max-width:560px;margin:0 auto;padding:32px 14px">

<!-- Genio icon -->
<div style="text-align:center;margin-bottom:16px">
<p style="font-size:32px;margin:0">🧞</p>
</div>

<!-- Main card -->
<div style="background-color:#2d1a08;border-radius:20px;border:1px solid rgba(232,168,76,0.25);padding:28px 20px">

<!-- Logo -->
<div style="text-align:center;margin-bottom:12px">
  ${logoUrl
    ? `<img src="${logoUrl}" alt="${restaurantName}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid rgba(232,168,76,0.3)" />`
    : `<table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#1a1a1a;border:2px solid rgba(232,168,76,0.3);text-align:center;vertical-align:middle;font-size:22px;font-weight:900;color:#F4A623">${initials}</td></tr></table>`
  }
</div>

<!-- Title -->
<h2 style="color:#FFD600;font-size:22px;margin:0 0 6px;text-align:center;font-family:Georgia,serif;line-height:1.3">
  ${ownerName}, tu carta está lista
</h2>
<p style="color:#c0a060;font-size:12px;text-align:center;margin:0 0 20px;letter-spacing:0.5px;text-transform:uppercase;font-weight:600">
  ${restaurantName}
</p>

<!-- Description -->
<p style="color:#c0a060;font-size:15px;line-height:1.65;margin:0 0 22px;text-align:center">
  Transformamos tu carta en una experiencia digital con <strong style="color:#FFD600">${dishCount} platos</strong> organizados y listos para tus clientes.
</p>

<!-- Features box -->
<div style="background:#3a2210;border:1px solid #5a3a18;border-radius:14px;padding:16px 18px;margin-bottom:24px">
  <p style="color:#FFD600;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 10px">Lo que incluye tu carta</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:5px 0;color:#c0a060;font-size:14px;line-height:1.5"><span style="color:#F4A623;margin-right:6px">✓</span> ${dishCount} platos con fotos por categoría</td></tr>
    <tr><td style="padding:5px 0;color:#c0a060;font-size:14px;line-height:1.5"><span style="color:#F4A623;margin-right:6px">✓</span> 3 vistas distintas para tus clientes</td></tr>
    <tr><td style="padding:5px 0;color:#c0a060;font-size:14px;line-height:1.5"><span style="color:#F4A623;margin-right:6px">✓</span> Primeros platos traducidos al inglés</td></tr>
    <tr><td style="padding:5px 0;color:#c0a060;font-size:14px;line-height:1.5"><span style="color:#F4A623;margin-right:6px">✓</span> Lista para compartir por QR o link</td></tr>
  </table>
</div>

<!-- CTA button -->
<div style="text-align:center;margin-bottom:14px">
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${clickUrl}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="24%" fillcolor="#f3a333" stroke="f">
    <w:anchorlock/>
    <center style="color:#0D0D0D;font-family:Georgia,serif;font-size:16px;font-weight:900;">Ver mi carta →</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-->
  <a href="${clickUrl}" style="display:inline-block;background:#f3a333;color:#0D0D0D;font-size:16px;font-weight:900;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;font-family:Georgia,serif;mso-padding-alt:0">
    Ver mi carta →
  </a>
  <!--<![endif]-->
</div>

<!-- Secondary link -->
<div style="text-align:center;margin-bottom:20px">
  <a href="${activarUrl}" style="color:#F4A623;font-size:13px;text-decoration:underline;font-weight:600">
    Activar mi carta
  </a>
</div>

<!-- Divider + footer text -->
<div style="border-top:1px solid rgba(232,168,76,0.15);padding-top:18px">
  <p style="color:#c0a060;font-size:12px;line-height:1.55;margin:0;text-align:center;opacity:0.85">
    Este es tu link vivo. Compártelo con tus clientes o imprímelo en un QR.<br>
    ¿Algo no está bien? Responde este email o escríbenos a <a href="mailto:hola@quierocomer.cl" style="color:#F4A623;text-decoration:none">hola@quierocomer.cl</a>
  </p>
</div>

<img src="${openPixel}" alt="" width="1" height="1" style="display:none" />
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:28px">
<p style="color:#5a4028;font-size:12px;margin:0">Hecho con 💛 y mucha hambre · QuieroComer.cl</p>
</div>

</div>
</body></html>`;
}
