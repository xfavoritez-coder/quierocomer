import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/preview-email/weekly-trial?week=1|2
 * Preview the trial weekly email.
 * week=1: first week (fake data preview)
 * week=2: second week (low data motivational)
 */
export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week") || "1";

  const html = week === "2"
    ? buildTrialWeek2Html({
        ownerName: "Simón",
        restaurantName: "Tres Toques",
        logoUrl: null,
        daysLeft: 5,
        totalVisits: 3,
        photosUploaded: 0,
        dishesEdited: 2,
        totalDishes: 143,
        panelUrl: "https://quierocomer.cl/panel",
        slug: "tres-toques",
      })
    : buildTrialWeek1Html({
        ownerName: "Simón",
        restaurantName: "Tres Toques",
        logoUrl: null,
        daysLeft: 12,
        totalDishes: 143,
        categories: 20,
        topDishes: ["Roll Acevichado", "Tabla Especial", "Cerveza Austral Lager"],
        panelUrl: "https://quierocomer.cl/panel",
        slug: "tres-toques",
      });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * Week 1: "Así será tu informe semanal" — fake data preview
 */
export function buildTrialWeek1Html({
  ownerName, restaurantName, logoUrl, daysLeft, totalDishes, categories, topDishes, panelUrl, slug,
}: {
  ownerName: string; restaurantName: string; logoUrl: string | null;
  daysLeft: number; totalDishes: number; categories: number;
  topDishes: string[]; panelUrl: string; slug: string;
}): string {
  const initials = restaurantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

  const fakeTopRows = topDishes.slice(0, 3).map((name, i) => {
    const count = [42, 35, 28][i];
    const pct = Math.round((count / 42) * 100);
    return `
    <tr><td style="padding:${i > 0 ? "10px" : "0"} 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="28" valign="middle">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="26" height="26" style="width:26px;height:26px;border-radius:50%;background:#f29a00;color:#fff;font-weight:900;font-size:12px;text-align:center;vertical-align:middle">${i + 1}</td>
          </tr></table>
        </td>
        <td width="10"></td>
        <td valign="middle">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:14px;font-weight:700;color:#1a1a1a;">${name}</td>
              <td width="40" align="right" style="font-size:13px;font-weight:800;color:#f29a00;">${count}</td>
            </tr>
            <tr><td colspan="2" style="padding-top:4px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#eadcc2;border-radius:3px;height:4px;">
                  <div style="width:${pct}%;height:4px;border-radius:3px;background:#f29a00;"></div>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td>
      </tr></table>
    </td></tr>`;
  }).join("");

  const fakeHourBars = [
    { h: "12", c: 18 }, { h: "13", c: 32 }, { h: "14", c: 25 },
    { h: "19", c: 15 }, { h: "20", c: 38 }, { h: "21", c: 42 }, { h: "22", c: 20 },
  ].map(({ h, c }) => {
    const pct = Math.round((c / 42) * 100);
    return `<td style="vertical-align:bottom;text-align:center;padding:0 2px;width:${Math.floor(100 / 7)}%">
      <div style="background:#f29a00;border-radius:3px 3px 0 0;height:${Math.max(4, pct * 0.5)}px;margin:0 auto;width:100%;max-width:24px"></div>
      <div style="font-size:10px;color:#8a724f;margin-top:3px">${h}h</div>
    </td>`;
  }).join("");

  return `<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:24px;border:1px solid #ead7b7">
<tr><td style="padding:28px 22px 24px">

<!-- Header: logo + name -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
  <td width="36" valign="middle">
    ${logoUrl
      ? `<img src="${logoUrl}" width="36" height="36" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />`
      : `<table cellpadding="0" cellspacing="0" border="0"><tr><td width="36" height="36" style="width:36px;height:36px;border-radius:50%;background:#10251a;text-align:center;vertical-align:middle;font-size:14px;font-weight:900;color:#f2d99f">${initials}</td></tr></table>`
    }
  </td>
  <td width="10"></td>
  <td style="font-family:Georgia,serif;font-size:18px;font-weight:400;color:#1a1a1a">${restaurantName}</td>
</tr>
</table>

<!-- Demo badge -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding:16px 0 4px">
  <table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:#fff3d8;color:#9a5a00;font-size:11px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;padding:6px 12px;border-radius:50px">
      ✨ Así será tu informe semanal
    </td>
  </tr></table>
</td></tr>
</table>

<!-- Greeting -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding:14px 0 8px">
  <p style="font-family:Georgia,serif;font-size:24px;line-height:1.1;color:#1a1a1a;margin:0">
    ${ownerName}, tu primera semana
  </p>
</td></tr>
<tr><td style="padding-bottom:18px">
  <p style="font-size:14px;color:#7a6547;line-height:1.5;margin:0">
    Cada lunes recibirás un resumen como este con los datos reales de tu carta. Por ahora te mostramos cómo se verá con datos de ejemplo.
  </p>
</td></tr>
</table>

<!-- Fake stats row -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
  <td width="50%" style="padding-right:6px">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border-radius:14px;border:1px solid #ead7b7">
    <tr><td style="padding:14px 16px">
      <p style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Visitas</p>
      <p style="font-size:28px;font-weight:900;color:#1a1a1a;margin:0">147</p>
      <p style="font-size:11px;color:#16a34a;font-weight:700;margin:2px 0 0">+23%</p>
    </td></tr>
    </table>
  </td>
  <td width="50%" style="padding-left:6px">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border-radius:14px;border:1px solid #ead7b7">
    <tr><td style="padding:14px 16px">
      <p style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Clientes nuevos</p>
      <p style="font-size:28px;font-weight:900;color:#1a1a1a;margin:0">12</p>
      <p style="font-size:11px;color:#16a34a;font-weight:700;margin:2px 0 0">+15%</p>
    </td></tr>
    </table>
  </td>
</tr>
</table>

<!-- Top dishes -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px">
<tr><td>
  <p style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Platos más vistos</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    ${fakeTopRows}
  </table>
</td></tr>
</table>

<!-- Hours chart -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px">
<tr><td>
  <p style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Horarios con más visitas</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border-radius:14px;border:1px solid #ead7b7;padding:14px">
  <tr><td style="padding:14px 10px 10px">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="height:60px">
    <tr>${fakeHourBars}</tr>
    </table>
  </td></tr>
  </table>
</td></tr>
</table>

<!-- Genio insight -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;background:#f0ebe0;border-radius:16px;border:1px solid #ead7b7">
<tr><td style="padding:16px 18px">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td width="28" valign="top" style="font-size:20px">🧞</td>
    <td valign="top" style="padding-left:6px">
      <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin:0 0 4px">${topDishes[0] ? `Destaca ${topDishes[0]}` : "Tu carta está lista"}</p>
      <p style="font-size:13px;color:#7a6547;line-height:1.45;margin:0">Tu plato más visto recibe mucha atención. Márcalo como recomendado para que aparezca primero.</p>
    </td>
  </tr>
  </table>
</td></tr>
</table>

<!-- Disclaimer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;border-top:1px dashed #ead7b7">
<tr><td style="padding-top:14px;text-align:center">
  <p style="font-size:12px;color:#927955;line-height:1.5;margin:0">
    Estos son datos de ejemplo. Cuando pongas el QR en tus mesas, verás tus estadísticas reales aquí cada lunes.
  </p>
  <p style="font-size:12px;color:#f29a00;font-weight:700;margin:8px 0 0">Te quedan ${daysLeft} días de prueba gratis</p>
</td></tr>
</table>

<!-- CTA -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding:18px 0 0">
  <a href="${panelUrl}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:16px 0;border-radius:14px;text-decoration:none;text-align:center;max-width:300px;margin:0 auto">
    Entrar a mi panel →
  </a>
</td></tr>
</table>

</td></tr>
</table>

<!-- Footer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:24px">
  <p style="color:#927955;font-size:12px;margin:0">
    ¿Necesitas ayuda? <a href="https://quierocomer.cl/#contacto" style="color:#f29a00;text-decoration:underline;font-weight:700">Contáctanos</a>
  </p>
  <p style="color:#b8a888;font-size:11px;margin:6px 0 0">QuieroComer.cl · 2026</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;
}

/**
 * Week 2: Motivational — low data, trial ending soon
 */
export function buildTrialWeek2Html({
  ownerName, restaurantName, logoUrl, daysLeft, totalVisits,
  photosUploaded, dishesEdited, totalDishes, panelUrl, slug,
}: {
  ownerName: string; restaurantName: string; logoUrl: string | null;
  daysLeft: number; totalVisits: number;
  photosUploaded: number; dishesEdited: number; totalDishes: number;
  panelUrl: string; slug: string;
}): string {
  const initials = restaurantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

  const checks = [
    { done: true, label: "Carta creada", sub: `${totalDishes} platos listos` },
    { done: dishesEdited > 0, label: "Platos revisados", sub: dishesEdited > 0 ? `${dishesEdited} editados` : "Revisa precios y descripciones" },
    { done: photosUploaded > 0, label: "Fotos subidas", sub: photosUploaded > 0 ? `${photosUploaded} fotos reales` : "Sube fotos desde tu panel" },
    { done: totalVisits >= 5, label: "QR en las mesas", sub: totalVisits >= 5 ? `${totalVisits} visitas esta semana` : "Imprime y pon el QR en tus mesas" },
  ];

  const checkRows = checks.map(c => `
    <tr><td style="padding:8px 0;vertical-align:top;width:28px">
      <span style="font-size:16px">${c.done ? "✅" : "⬜"}</span>
    </td><td style="padding:8px 0;padding-left:8px;vertical-align:middle">
      <p style="font-size:14px;font-weight:${c.done ? "700" : "600"};color:${c.done ? "#1a1a1a" : "#7a6547"};margin:0">${c.label}</p>
      <p style="font-size:12px;color:${c.done ? "#16a34a" : "#927955"};margin:2px 0 0">${c.sub}</p>
    </td></tr>
  `).join("");

  return `<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0;-webkit-text-size-adjust:100%">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>

<!-- Main card -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:24px;border:1px solid #ead7b7">
<tr><td style="padding:28px 22px 24px">

<!-- Header: logo + name -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
  <td width="36" valign="middle">
    ${logoUrl
      ? `<img src="${logoUrl}" width="36" height="36" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />`
      : `<table cellpadding="0" cellspacing="0" border="0"><tr><td width="36" height="36" style="width:36px;height:36px;border-radius:50%;background:#10251a;text-align:center;vertical-align:middle;font-size:14px;font-weight:900;color:#f2d99f">${initials}</td></tr></table>`
    }
  </td>
  <td width="10"></td>
  <td style="font-family:Georgia,serif;font-size:18px;font-weight:400;color:#1a1a1a">${restaurantName}</td>
</tr>
</table>

<!-- Trial countdown -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px">
<tr><td style="text-align:center;padding:16px;background:#f0ebe0;border-radius:16px;border:1px solid #ead7b7">
  <p style="font-size:12px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px">Tu prueba gratis</p>
  <p style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:#1a1a1a;margin:0">${daysLeft} días</p>
  <p style="font-size:13px;color:#7a6547;margin:4px 0 0">restantes</p>
</td></tr>
</table>

<!-- Greeting -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding:18px 0 6px">
  <p style="font-family:Georgia,serif;font-size:22px;line-height:1.1;color:#1a1a1a;margin:0">
    ${ownerName}, tu segunda semana
  </p>
</td></tr>
<tr><td style="padding-bottom:16px">
  <p style="font-size:14px;color:#7a6547;line-height:1.5;margin:0">
    ${totalVisits > 0
      ? `Ya tuviste ${totalVisits} visita${totalVisits > 1 ? "s" : ""} esta semana. Cada vez que un cliente escanea tu QR, aparecerá en tu informe.`
      : "Tu carta está lista esperando sus primeras visitas. Solo falta poner el QR en las mesas para empezar a medir."
    }
  </p>
</td></tr>
</table>

<!-- Checklist -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border-radius:16px;border:1px solid #ead7b7;margin-bottom:16px">
<tr><td style="padding:16px 18px">
  <p style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Tu progreso</p>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    ${checkRows}
  </table>
</td></tr>
</table>

<!-- Genio tip -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ebe0;border-radius:16px;border:1px solid #ead7b7">
<tr><td style="padding:16px 18px">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td width="28" valign="top" style="font-size:20px">🧞</td>
    <td valign="top" style="padding-left:6px">
      <p style="font-size:13px;font-weight:800;color:#1a1a1a;margin:0 0 4px">Consejo del Genio</p>
      <p style="font-size:13px;color:#7a6547;line-height:1.45;margin:0">
        ${totalVisits < 5
          ? "Comparte el link de tu carta por Instagram o WhatsApp. Así tus clientes pueden verla antes de llegar al local."
          : "Ya tienes visitas. Marca tus platos estrella como \"recomendados\" desde el panel para que aparezcan destacados."
        }
      </p>
    </td>
  </tr>
  </table>
</td></tr>
</table>

<!-- CTA -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding:20px 0 8px">
  <a href="${panelUrl}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:16px 0;border-radius:14px;text-decoration:none;text-align:center;max-width:300px;margin:0 auto">
    Entrar a mi panel →
  </a>
</td></tr>
<tr><td style="text-align:center;padding-bottom:8px">
  <a href="${baseUrl}/qr/${slug}" style="display:block;background:transparent;color:#7a6547;font-size:14px;font-weight:700;padding:12px 0;border-radius:14px;text-decoration:none;border:1.5px solid #ead7b7;text-align:center;max-width:300px;margin:0 auto">
    Ver mi carta
  </a>
</td></tr>
</table>

<!-- Help -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #ead7b7;margin-top:12px">
<tr><td style="padding-top:16px;text-align:center">
  <p style="font-size:13px;color:#7a6547;line-height:1.5;margin:0">
    ¿Tienes dudas o necesitas ayuda? <a href="https://quierocomer.cl/#contacto" style="color:#f29a00;text-decoration:underline;font-weight:700">Contáctanos</a>
  </p>
</td></tr>
</table>

</td></tr>
</table>

<!-- Footer -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:24px">
  <p style="color:#b8a888;font-size:11px;margin:0">QuieroComer.cl · 2026</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;
}
