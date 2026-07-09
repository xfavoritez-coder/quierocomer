const BASE_URL = "https://quierocomer.cl";
const GOLD = "#e8930a";

interface Params {
  ownerName: string;
  localName: string;
  ctaUrl: string;
  hasMagicLink: boolean;
}

const THEMES = [
  { label: "Carbón", bg: "#1d1812", color: "#d8ad57" },
  { label: "Huerto", bg: "#e8f0ec", color: "#3f6b4c" },
  { label: "Mediterráneo", bg: "#eef3f9", color: "#2f5d8a" },
  { label: "Piedra", bg: "#3d3730", color: "#beb2a2" },
];

export function buildExportarCartaEmail({ ownerName, localName, ctaUrl, hasMagicLink }: Params): string {
  const firstName = ownerName?.split(" ")[0] || "Hola";
  const restaurantName = localName || "tu restaurante";

  const themePills = THEMES.map(t =>
    `<td style="padding-right:6px;padding-bottom:6px;">
      <a href="${ctaUrl}" style="display:inline-block;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;background:${t.bg};color:${t.color};text-decoration:none;">${t.label}</a>
    </td>`
  ).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:28px;">
    <a href="${BASE_URL}" style="text-decoration:none;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:7px;"><img src="${BASE_URL}/logo.png" alt="" width="26" style="display:block;width:26px;height:auto;" /></td>
        <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:17px;color:${GOLD};font-weight:normal;">QuieroComer</span></td>
      </tr></table>
    </a>
  </td></tr>

  <!-- Hero headline -->
  <tr><td align="center" style="padding-bottom:8px;">
    <h1 style="margin:0;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.3;">Tu carta, sin depender del WiFi</h1>
  </td></tr>
  <tr><td align="center" style="padding-bottom:24px;">
    <p style="margin:0;font-size:15px;color:#666;line-height:1.6;">
      Hola ${firstName} — ahora puedes imprimir la carta de <strong style="color:#1a1a1a;">${restaurantName}</strong><br>
      en 4 diseños profesionales, en segundos.
    </p>
  </td></tr>

  <!-- Theme pills (above preview, each links to CTA) -->
  <tr><td style="padding-bottom:12px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>${themePills}</tr></table>
  </td></tr>

  <!-- Mini carta preview -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:16px;overflow:hidden;border:1px solid #ddd;">

      <!-- Dark header (Carbon style) -->
      <tr><td style="background:linear-gradient(135deg,#2b231a,#1d1812);padding:20px 24px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:9px;color:#d8ad5780;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">✦ ✦ ✦</div>
        <div style="font-family:Georgia,serif;font-size:22px;color:#d8ad57;letter-spacing:0.1em;font-weight:bold;">${restaurantName.toUpperCase()}</div>
        <div style="font-size:8px;color:#d8ad5760;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;">CARTA · MENU · CARDÁPIO</div>
      </td></tr>

      <!-- Menu content -->
      <tr><td style="background:#fffdf8;padding:16px 20px;">
        <div style="font-size:9px;font-weight:700;color:#888;letter-spacing:0.14em;text-transform:uppercase;text-align:center;margin-bottom:12px;">— Platos principales —</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:12px;color:#2a2a2a;font-family:Georgia,serif;padding-bottom:6px;">Pasta al pomodoro</td>
            <td style="font-size:11px;color:#ccc;text-align:right;padding-bottom:6px;">· · · · · · ·</td>
            <td style="font-size:12px;color:${GOLD};font-weight:600;text-align:right;white-space:nowrap;padding-bottom:6px;padding-left:8px;">$9.900</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#2a2a2a;font-family:Georgia,serif;padding-bottom:6px;">Risotto de hongos</td>
            <td style="font-size:11px;color:#ccc;text-align:right;padding-bottom:6px;">· · · · · · ·</td>
            <td style="font-size:12px;color:${GOLD};font-weight:600;text-align:right;white-space:nowrap;padding-bottom:6px;padding-left:8px;">$12.500</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#2a2a2a;font-family:Georgia,serif;">Filete a la parrilla</td>
            <td style="font-size:11px;color:#ccc;text-align:right;">· · · · · · ·</td>
            <td style="font-size:12px;color:${GOLD};font-weight:600;text-align:right;white-space:nowrap;padding-left:8px;">$16.900</td>
          </tr>
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
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <a href="${BASE_URL}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.cl</a>
    <br/><span style="font-size:10px;color:#ccc;">&copy; ${new Date().getFullYear()} QuieroComer</span>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
