/**
 * Template de email para presentar QuieroComer.cl a dueños de restaurante.
 * Incluye tracking de apertura, click y desuscripción.
 */

export const CAMPAIGN_SUBJECT = "Vende más con una carta QR que vende sola";

export function buildQuieroComerEmailHtml({ email, campaignId }: { email: string; campaignId: string }): string {
  const base = "https://quierocomer.cl";
  const desuscribirUrl = `${base}/desuscribir?email=${encodeURIComponent(email)}`;
  const trackOpenUrl = `${base}/api/platform/track/open?cid=${campaignId}&e=${encodeURIComponent(email)}`;
  const trackClickUrl = `${base}/api/platform/track/click?cid=${campaignId}&e=${encodeURIComponent(email)}&url=${encodeURIComponent(base)}`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head>
<body style="background:#f5f0e8;font-family:Georgia,serif;margin:0;padding:24px 16px;color:#111111">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,0.06)">

<!-- Header -->
<div style="background:linear-gradient(135deg,#111111,#1a1a1a);padding:40px 32px;text-align:center">
  <p style="font-size:42px;margin:0 0 14px">🧞</p>
  <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;margin:0 0 6px">
    <span style="color:#ffffff">Quiero</span><span style="color:#fbbf24">Comer</span>
  </h1>
  <p style="font-size:13px;color:#999999;margin:0">La carta QR con IA para restaurantes</p>
</div>

<!-- Body -->
<div style="padding:36px 32px;background:#ffffff">

  <p style="font-size:20px;color:#d4a015;font-weight:700;line-height:1.4;margin:0 0 20px">
    Tu carta puede vender más por ti.
  </p>

  <p style="font-size:15px;color:#444444;line-height:1.7;margin:0 0 28px">
    <strong style="color:#111111">QuieroComer</strong> es una carta QR con un garzón con IA integrado que conoce a cada comensal y lo guía hacia lo que quiere pedir.
  </p>

  <!-- Features -->
  <div style="margin-bottom:28px">
    <div style="display:flex;gap:14px;padding:16px;background:#fefaf0;border-radius:12px;border-left:3px solid #fbbf24;margin-bottom:10px">
      <span style="font-size:22px;flex-shrink:0;margin-right:4px">🧞</span>
      <div>
        <p style="font-size:14px;font-weight:700;color:#111111;margin:0 0 4px">El Genio — tu garzón con IA</p>
        <p style="font-size:13px;color:#666666;line-height:1.5;margin:0">Recomienda platos según gustos y restricciones de cada cliente.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;padding:16px;background:#fefaf0;border-radius:12px;border-left:3px solid #fbbf24;margin-bottom:10px">
      <span style="font-size:22px;flex-shrink:0;margin-right:4px">💰</span>
      <div>
        <p style="font-size:14px;font-weight:700;color:#111111;margin:0 0 4px">Más ventas por mesa</p>
        <p style="font-size:13px;color:#666666;line-height:1.5;margin:0">Sugiere complementos, postres y bebidas. Cada cliente pide más sin presión.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;padding:16px;background:#fefaf0;border-radius:12px;border-left:3px solid #fbbf24;margin-bottom:10px">
      <span style="font-size:22px;flex-shrink:0;margin-right:4px">🔔</span>
      <div>
        <p style="font-size:14px;font-weight:700;color:#111111;margin:0 0 4px">Llamada al garzón</p>
        <p style="font-size:13px;color:#666666;line-height:1.5;margin:0">Un botón en la carta y el garzón recibe la alerta. Sin apps, sin instalaciones.</p>
      </div>
    </div>
    <div style="display:flex;gap:14px;padding:16px;background:#fefaf0;border-radius:12px;border-left:3px solid #fbbf24">
      <span style="font-size:22px;flex-shrink:0;margin-right:4px">📊</span>
      <div>
        <p style="font-size:14px;font-weight:700;color:#111111;margin:0 0 4px">Estadísticas avanzadas</p>
        <p style="font-size:13px;color:#666666;line-height:1.5;margin:0">Qué platos miran más vs cuáles piden. Qué funciona cada día.</p>
      </div>
    </div>
  </div>

  <!-- Pricing -->
  <div style="background:#fefaf0;border:1px solid #f5e6c8;border-radius:14px;padding:24px;margin-bottom:28px;text-align:center">
    <p style="font-size:11px;font-weight:700;color:#d4a015;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 12px">Plan gratuito disponible</p>
    <p style="font-size:15px;color:#444444;line-height:1.6;margin:0">
      Empieza gratis con carta QR + El Genio incluido.
    </p>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:8px">
    <a href="${trackClickUrl}" style="display:inline-block;padding:16px 44px;background:#fbbf24;border-radius:12px;font-size:15px;font-weight:700;color:#111111;text-decoration:none;letter-spacing:0.04em">Ver cómo funciona →</a>
  </div>

</div>

<!-- Footer -->
<div style="background:#faf6ee;padding:20px 32px;border-top:1px solid #f0e8d0;text-align:center">
  <p style="font-size:13px;font-weight:700;color:#d4a015;margin:0 0 6px">🧞 El equipo de QuieroComer</p>
  <p style="font-size:11px;color:#a08040;line-height:1.6;margin:0">quierocomer.cl · Hecho en Chile<br><a href="${desuscribirUrl}" style="color:#c47f1a">Desuscribirse</a></p>
</div>

<img src="${trackOpenUrl}" width="1" height="1" style="display:none" />
</div></body></html>`;
}
