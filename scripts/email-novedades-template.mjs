/**
 * Template base para emails de novedades de QuieroComer.
 *
 * Uso:
 *   import { buildNovedadesEmail, logoBlock } from "./email-novedades-template.mjs";
 *
 *   const html = buildNovedadesEmail({
 *     heroTitle:    "Tu panel<br/>acaba de crecer.",
 *     heroSubtitle: "Tres cosas nuevas...",
 *     blocks:       [ featureCard({ badge, title, body, preview }) ],
 *     ctaUrl:       "https://quierocomer.com/panel",
 *     ctaText:      "Ver mi panel →",
 *     ctaNote:      "Ya está disponible — entra y configúralo en minutos.",
 *     // Opcional — personalización por restaurante:
 *     restaurantName: "Mi Local",
 *     restaurantSlug: "mi-local",
 *     logoUrl:        "https://...",
 *   });
 */

// ── Logo del local (img redonda o iniciales con gradiente) ─────────────────
export function logoBlock(logoUrl, name, size = 64) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 12px;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#F4A623,#e8941a);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.34)}px;font-weight:800;color:#fff;font-family:Arial,sans-serif;margin:0 auto 12px;text-align:center;line-height:${size}px;">${initials}</div>`;
}

// ── Tarjeta de feature ─────────────────────────────────────────────────────
export function featureCard({ badge = "Nuevo", title, body, preview = "" }) {
  return `
  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:26px 28px 20px;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#F4A623;font-weight:700;">${badge}</p>
        <h2 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#ffffff;">${title}</h2>
        <p style="margin:0;font-size:14px;color:#777;line-height:1.65;">${body}</p>
      </td></tr>
      ${preview ? `<tr><td style="padding:0 28px 24px;">${preview}</td></tr>` : ""}
    </table>
  </td></tr>`;
}

// ── Template completo ──────────────────────────────────────────────────────
export function buildNovedadesEmail({
  heroTitle,
  heroSubtitle,
  blocks = [],
  ctaUrl = "https://quierocomer.com/panel",
  ctaText = "Ver mi panel →",
  ctaNote = "Ya está disponible — entra y configúralo en minutos.",
} = {}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${heroTitle?.replace(/<[^>]*>/g, " ").trim() || "Novedades QuieroComer"}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px 60px;">
<table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

  <!-- Logo QC + etiqueta Novedades — lado a lado, alineados a la izquierda -->
  <tr><td style="padding-bottom:36px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;padding-right:10px;">
        <img src="https://quierocomer.com/logo.png" alt="QuieroComer" width="28" height="28" style="width:28px;height:28px;display:block;" />
      </td>
      <td style="vertical-align:middle;">
        <p style="margin:0;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#555;font-weight:600;">Novedades</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Hero title -->
  <tr><td style="padding-bottom:16px;">
    <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;line-height:1.15;letter-spacing:-.5px;">${heroTitle || ""}</h1>
  </td></tr>

  ${heroSubtitle ? `<!-- Hero subtitle -->
  <tr><td style="padding-bottom:44px;">
    <p style="margin:0;font-size:15px;color:#888;line-height:1.7;max-width:380px;">${heroSubtitle}</p>
  </td></tr>` : ""}

  <!-- Feature blocks -->
  ${blocks.join("\n")}

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:48px;">
    <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#ffc44f,#F4A623);color:#100b03;text-decoration:none;font-size:15px;font-weight:800;padding:16px 40px;border-radius:999px;letter-spacing:-.1px;">
      ${ctaText}
    </a>
    ${ctaNote ? `<p style="margin:16px 0 0;font-size:13px;color:#999;font-weight:500;">${ctaNote}</p>` : ""}
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #222;padding-top:28px;" align="center">
    <p style="margin:0 0 4px;font-size:13px;color:#666;font-weight:700;letter-spacing:.05em;">QuieroComer</p>
    <p style="margin:0;font-size:11px;color:#444;">Marketing gastronómico</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
