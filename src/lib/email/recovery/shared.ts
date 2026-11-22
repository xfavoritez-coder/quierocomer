// Funciones compartidas para los emails de recuperación inteligente.

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Envuelve el contenido central en la plantilla branded de recuperación. */
export function wrapRecoveryEmail(opts: {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  bodyHtml: string;
  trackOpenUrl?: string | null;
  unsubscribeUrl?: string | null;
}): string {
  const { storeName, logoUrl, accent, bodyHtml, trackOpenUrl, unsubscribeUrl } = opts;
  const a = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent) ? accent : "#e63946";
  const headerLogo = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(storeName)}" style="height:auto;width:auto;max-height:80px;max-width:280px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.3px;">${esc(storeName)}</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
  <tr><td style="background:${a};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
    ${headerLogo}
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 28px;">
    ${bodyHtml}
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <span style="font-size:11px;color:#aaa;">Powered by QuieroComer.cl</span>
    ${unsubscribeUrl ? `<br/><a href="${esc(unsubscribeUrl)}" style="font-size:11px;color:#bbb;text-decoration:underline;">Dejar de recibir estos correos</a>` : ""}
  </td></tr>
</table>
${trackOpenUrl ? `<img src="${esc(trackOpenUrl)}" width="1" height="1" style="display:none" alt="" />` : ""}
</td></tr></table>
</body></html>`;
}

/** Genera HTML para un botón CTA con color de marca. */
export function ctaButton(label: string, href: string, accent: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:24px 0 0;">
  <a href="${esc(href)}" style="display:inline-block;background:${accent};color:#fff;font-size:15px;font-weight:800;padding:14px 36px;border-radius:12px;text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

/** Nombre para el saludo (primer nombre). */
export function firstName(name?: string | null): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

export { esc };
