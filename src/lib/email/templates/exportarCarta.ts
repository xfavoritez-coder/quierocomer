const BASE_URL = "https://quierocomer.cl";
const GOLD = "#e8930a";

interface Dish {
  name: string;
  price: number;
  photoUrl: string | null;
}

interface Params {
  ownerName: string;
  localName: string;
  ctaUrl: string;
  hasMagicLink: boolean;
  logoUrl?: string | null;
  qrUrl?: string | null;
  dishes?: Dish[];
}

const THEMES = [
  { label: "Carbón", bg: "#1d1812", color: "#d8ad57" },
  { label: "Huerto", bg: "#e8f0ec", color: "#3f6b4c" },
  { label: "Mediterráneo", bg: "#eef3f9", color: "#2f5d8a" },
  { label: "Piedra", bg: "#3d3730", color: "#beb2a2" },
];

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`;
}

// Placeholder dishes if none provided
const PLACEHOLDER_DISHES: Dish[] = [
  { name: "Pasta al pomodoro", price: 9900, photoUrl: null },
  { name: "Risotto de hongos", price: 12500, photoUrl: null },
  { name: "Filete a la parrilla", price: 16900, photoUrl: null },
];

// Gray fallback square for dishes without photo (email-safe inline SVG as data URI)
const FALLBACK_PHOTO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Crect width='52' height='52' fill='%23e8e2d4'/%3E%3Ctext x='26' y='32' text-anchor='middle' font-size='20' fill='%23b0a898'%3E🍽%3C/text%3E%3C/svg%3E";

export function buildExportarCartaEmail({ ownerName, localName, ctaUrl, hasMagicLink, logoUrl, qrUrl, dishes }: Params): string {
  const firstName = ownerName?.split(" ")[0] || "Hola";
  const restaurantName = localName || "tu restaurante";
  const dishList = (dishes && dishes.length > 0) ? dishes.slice(0, 3) : PLACEHOLDER_DISHES;

  const themePills = THEMES.map(t =>
    `<td style="padding-right:6px;">
      <a href="${ctaUrl}" style="display:inline-block;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;background:${t.bg};color:${t.color};text-decoration:none;white-space:nowrap;">${t.label}</a>
    </td>`
  ).join("");

  const dishRows = dishList.map(d => {
    const photo = d.photoUrl || FALLBACK_PHOTO;
    return `<tr>
      <td style="padding-bottom:8px;width:52px;vertical-align:top;">
        <img src="${photo}" width="52" height="52" alt="" style="display:block;width:52px;height:52px;border-radius:6px;object-fit:cover;border:1px solid #e8dcc4;" />
      </td>
      <td style="padding-bottom:8px;padding-left:10px;vertical-align:middle;">
        <div style="font-size:12px;color:#2a2a2a;font-family:Georgia,serif;font-weight:700;">${d.name}</div>
      </td>
      <td style="padding-bottom:8px;text-align:right;vertical-align:middle;white-space:nowrap;padding-left:8px;">
        <span style="font-size:12px;color:${GOLD};font-weight:700;">${formatPrice(d.price)}</span>
      </td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

  <!-- Logo QC -->
  <tr><td align="center" style="padding-bottom:28px;">
    <a href="${BASE_URL}" style="text-decoration:none;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:7px;"><img src="${BASE_URL}/logo.png" alt="" width="26" style="display:block;width:26px;height:auto;" /></td>
        <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:17px;color:${GOLD};font-weight:normal;">QuieroComer</span></td>
      </tr></table>
    </a>
  </td></tr>

  <!-- Hero -->
  <tr><td align="center" style="padding-bottom:8px;">
    <h1 style="margin:0;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.3;">Tu carta, sin depender del WiFi</h1>
  </td></tr>
  <tr><td align="center" style="padding-bottom:24px;">
    <p style="margin:0;font-size:15px;color:#666;line-height:1.6;">
      Hola ${firstName} — ahora puedes imprimir la carta de <strong style="color:#1a1a1a;">${restaurantName}</strong><br>en 4 diseños profesionales, en segundos.
    </p>
  </td></tr>

  <!-- Theme pills centradas -->
  <tr><td align="center" style="padding-bottom:14px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>${themePills}</tr></table>
  </td></tr>

  <!-- Mini carta preview -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:16px;overflow:hidden;border:1px solid #ddd;">

      <!-- Header: logo izq | nombre centro | QR der -->
      <tr><td style="background:linear-gradient(135deg,#2b231a,#1d1812);padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <!-- Logo del local -->
          <td style="width:52px;vertical-align:middle;">
            ${logoUrl
              ? `<img src="${logoUrl}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #d8ad57;" />`
              : `<div style="width:48px;height:48px;border-radius:50%;background:#3a2f22;border:2px solid #d8ad5740;"></div>`
            }
          </td>
          <!-- Nombre y subtítulo -->
          <td style="text-align:center;vertical-align:middle;padding:0 12px;">
            <div style="font-family:Georgia,serif;font-size:8px;color:#d8ad5770;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">✦ ✦ ✦</div>
            <div style="font-family:Georgia,serif;font-size:18px;color:#d8ad57;letter-spacing:0.08em;font-weight:bold;line-height:1.2;">${restaurantName.toUpperCase()}</div>
            <div style="font-size:7px;color:#d8ad5750;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;">CARTA · MENU · CARDÁPIO</div>
          </td>
          <!-- QR del local -->
          <td style="width:64px;vertical-align:middle;text-align:right;">
            ${qrUrl
              ? `<div style="display:inline-block;padding:4px;background:#fff;border-radius:6px;border:2px solid #d8ad57;">
                  <img src="${qrUrl}" width="52" height="52" alt="QR" style="display:block;width:52px;height:52px;" />
                </div>`
              : `<div style="width:60px;height:60px;background:#3a2f22;border-radius:6px;border:1px solid #d8ad5730;"></div>`
            }
          </td>
        </tr></table>
      </td></tr>

      <!-- Dishes with photos -->
      <tr><td style="background:#fffdf8;padding:16px 20px;">
        <div style="font-size:9px;font-weight:700;color:#888;letter-spacing:0.14em;text-transform:uppercase;text-align:center;margin-bottom:12px;">— Platos —</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${dishRows}
        </table>
      </td></tr>

      <!-- Footer hint -->
      <tr><td style="background:#f9f5ee;padding:10px 20px;border-top:1px solid #e8dcc4;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-size:10px;color:#999;">📱 Incluye código QR para tu carta digital</td>
          <td align="right" style="font-size:10px;color:#999;">🌎 ES · EN · PT</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:8px;">
    <a href="${ctaUrl}" style="display:inline-block;background:${GOLD};color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">
      ${hasMagicLink ? "Ver mi carta imprimible →" : "Ir al panel →"}
    </a>
  </td></tr>
  <tr><td align="center" style="padding-bottom:28px;">
    <p style="margin:6px 0 0;font-size:11px;color:#aaa;">${hasMagicLink ? "Este enlace te lleva directo a tu panel, sin contraseña." : ""}</p>
  </td></tr>

  <!-- Footer -->
  <tr><td><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table></td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <a href="${BASE_URL}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.cl</a>
    <br/><span style="font-size:10px;color:#ccc;">&copy; ${new Date().getFullYear()} QuieroComer</span>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
