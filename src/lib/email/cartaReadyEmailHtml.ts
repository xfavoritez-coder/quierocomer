/**
 * Email que se envía al dueño cuando su carta está lista para ver.
 *
 * Colores siguiendo docs/dark-light-mode-emails.md:
 * - Texto principal: #8a7550 (marrón medio, legible en light y dark)
 * - Texto secundario: #b8a888 (beige medio)
 * - Acento gold: #e8930a (brillante, funciona siempre)
 * - Labels: #92400e (ámbar oscuro)
 * - Fondos: sólidos, sin gradientes
 * - Layout: table-based para máxima compatibilidad
 */
export function cartaReadyEmailHtml({
  ownerName,
  restaurantName,
  logoUrl,
  dishCount,
  clickUrl,
  openPixel,
  activarUrl,
  panelUrl,
}: {
  ownerName: string;
  restaurantName: string;
  logoUrl: string | null;
  dishCount: number;
  clickUrl: string;
  openPixel: string;
  activarUrl: string;
  panelUrl: string;
}): string {
  const initials = restaurantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return `<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;padding:32px 14px">
<tr><td>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9f6f0;border-radius:20px;border:1px solid #e8dcc4">
<tr><td style="padding:28px 20px">

<!-- Restaurant name + Logo -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:8px">
<p style="color:#b8a888;font-size:12px;margin:0;letter-spacing:0.5px;text-transform:uppercase;font-weight:600">
  ${restaurantName}
</p>
</td></tr>
<tr><td style="text-align:center;padding-bottom:20px">
  ${logoUrl
    ? `<img src="${logoUrl}" alt="${restaurantName}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #e8dcc4" />`
    : `<table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#f0ebe0;border:2px solid #e8dcc4;text-align:center;vertical-align:middle;font-size:22px;font-weight:900;color:#e8930a">${initials}</td></tr></table>`
  }
</td></tr>
</table>

<!-- Title -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:6px">
<h2 style="color:#1a1a1a;font-size:22px;margin:0;font-family:Georgia,serif;line-height:1.3">
  ${ownerName}, tu carta está lista
</h2>
</td></tr>
</table>

<!-- Description -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:22px">
<p style="color:#8a7550;font-size:15px;line-height:1.65;margin:0">
  Transformamos tu carta en una nueva carta <strong style="color:#e8930a">QR Inteligente</strong>.
</p>
</td></tr>
</table>

<!-- Features box -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border:1px solid #e8dcc4;border-radius:14px">
<tr><td style="padding:16px 18px">
  <p style="color:#92400e;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 10px">Lo que incluye tu carta</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:5px 0;color:#8a7550;font-size:14px;line-height:1.5"><span style="color:#e8930a;margin-right:6px">✓</span> ${dishCount} platos con fotos por categoría</td></tr>
    <tr><td style="padding:5px 0;color:#8a7550;font-size:14px;line-height:1.5"><span style="color:#e8930a;margin-right:6px">✓</span> 3 diseños distintos para tus clientes</td></tr>
    <tr><td style="padding:5px 0;color:#8a7550;font-size:14px;line-height:1.5"><span style="color:#e8930a;margin-right:6px">✓</span> Primeros platos traducidos al inglés</td></tr>
    <tr><td style="padding:5px 0;color:#8a7550;font-size:14px;line-height:1.5"><span style="color:#e8930a;margin-right:6px">✓</span> Lista para compartir por QR o link</td></tr>
    <tr><td style="padding:5px 0;color:#8a7550;font-size:14px;line-height:1.5"><span style="color:#e8930a;margin-right:6px">✓</span> Todas las funcionalidades Premium</td></tr>
  </table>
</td></tr>
</table>

<!-- CTA button -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding:24px 0 14px">
  <a href="${clickUrl}" style="display:block;background:#e8930a;color:#ffffff;font-size:16px;font-weight:900;padding:14px 0;border-radius:12px;text-decoration:none;letter-spacing:0.3px;font-family:Georgia,serif;text-align:center;max-width:280px;margin:0 auto">
    Ver mi carta →
  </a>
</td></tr>
</table>

<!-- Panel link -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:20px">
  <a href="${panelUrl}" style="display:block;background:transparent;color:#8a7550;font-size:14px;font-weight:700;padding:12px 0;border-radius:12px;text-decoration:none;border:2px solid #e8dcc4;font-family:Georgia,serif;text-align:center;max-width:280px;margin:0 auto">
    Ir a mi panel
  </a>
</td></tr>
</table>

<!-- Divider + footer text -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e8dcc4">
<tr><td style="padding-top:18px;text-align:center">
  <p style="color:#b8a888;font-size:12px;line-height:1.55;margin:0">
    Cualquier duda o consulta, no dudes en <a href="https://quierocomer.com/#contacto" style="color:#E8A33D;text-decoration:underline">contactarnos</a>.
  </p>
</td></tr>
</table>

<img src="${openPixel}" alt="" width="1" height="1" style="display:none" />

</td></tr>
</table>

<!-- Footer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:28px">
<p style="color:#b8a888;font-size:12px;margin:0">QuieroComer.cl · 2026 · Hecho en Chile</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;
}
