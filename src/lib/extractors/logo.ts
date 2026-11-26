// Mejora el logo extraído: muchos sitios (ej. Mercat) usan como logo principal una versión BLANCA
// pensada para su barra oscura, que sobre fondo blanco queda invisible. Si el logo es casi todo
// blanco (o vacío), se busca otra versión visible en la misma página: imagen para compartir,
// íconos y logos alternativos de los datos de la página.
import sharp from "sharp";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer-Bot/1.0)" };

/** Brillo medio de los píxeles visibles (0-1) y qué fracción del logo es visible. null si no se pudo leer. */
async function logoStats(url: string): Promise<{ lum: number; visible: number; aspect: number; photo: boolean } | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = sharp(buf, { animated: false });
    const meta = await img.metadata();
    const { data, info } = await img.resize(48, 48, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0, n = 0;
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) continue;
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255; n++;
      colors.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
    }
    const total = info.width * info.height;
    // Una foto (ej. un plato) no tiene transparencia y tiene cientos de colores; un logo, pocos o fondo transparente.
    const photo = n / total > 0.98 && colors.size > 150;
    return { lum: n ? sum / n : 1, visible: n / total, aspect: meta.width && meta.height ? Math.max(meta.width / meta.height, meta.height / meta.width) : 1, photo };
  } catch { return null; }
}

/** El logo se ve bien sobre fondo blanco (no es casi todo blanco ni vacío). */
const visibleCache = new Map<string, boolean | null>();
export async function isVisibleOnWhite(url: string): Promise<boolean | null> {
  if (visibleCache.has(url)) return visibleCache.get(url)!;
  const s = await logoStats(url);
  const v = s ? !(s.visible < 0.03 || s.lum > 0.9 || s.photo) : null;
  if (visibleCache.size > 500) visibleCache.clear();
  visibleCache.set(url, v);
  return v;
}

function abs(href: string, base: string) {
  try { return new URL(href.replace(/&amp;/g, "&"), base).toString(); } catch { return null; }
}

/** Otras imágenes candidatas a logo en la página, en orden de preferencia. */
function candidates(html: string, base: string): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => { if (u && /^https?:/.test(u) && !out.includes(u)) out.push(u); };
  // Datos de la página (Next.js / Mercat y similares): logos alternativos, favicon, imagen para compartir.
  for (const key of ["secondaryLogo", "appLogo", "logoDark", "darkLogo", "favicon", "shareImage", "icon"]) {
    for (const m of html.matchAll(new RegExp(`"${key}"\\s*:\\s*"(https?:[^"]+)"`, "gi"))) push(m[1].replace(/\\u002F/g, "/"));
  }
  const attr = (re: RegExp) => { for (const m of html.matchAll(re)) push(abs(m[1], base)); };
  attr(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/gi);
  attr(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["']/gi);
  attr(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+\.(?:png|jpg|jpeg|webp|svg)[^"']*)["']/gi);
  attr(/<link[^>]+href=["']([^"']+\.(?:png|jpg|jpeg|webp|svg)[^"']*)["'][^>]+rel=["'][^"']*icon[^"']*["']/gi);
  attr(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi);
  // La imagen para compartir suele ser una foto (ej. un plato): al final, y se descarta si parece foto.
  attr(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi);
  attr(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi);
  return out;
}

/** Devuelve un logo visible sobre fondo blanco: el original si sirve, o la mejor alternativa de la página. */
export async function improveLogo(logoUrl: string | null, pageUrl: string | null): Promise<string | null> {
  if (logoUrl) {
    const ok = await isVisibleOnWhite(logoUrl);
    if (ok !== false) return logoUrl; // sirve (o no se pudo revisar: se deja como está)
  }
  if (!pageUrl) return logoUrl;
  let html = "";
  try {
    const res = await fetch(pageUrl, { headers: UA, signal: AbortSignal.timeout(8000), redirect: "follow" });
    if (res.ok) html = await res.text();
  } catch { /* sin página: se queda el original */ }
  if (!html) return logoUrl;
  for (const c of candidates(html, pageUrl).slice(0, 8)) {
    if (c === logoUrl) continue;
    const s = await logoStats(c);
    if (s && s.visible >= 0.03 && s.lum <= 0.9 && s.aspect <= 3.2 && !s.photo) return c;
  }
  // Sin un logo visible: mejor ninguno (se muestra la inicial) que uno blanco o una foto.
  return logoUrl && (await isVisibleOnWhite(logoUrl)) === false ? null : logoUrl;
}
