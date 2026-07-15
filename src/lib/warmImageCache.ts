/**
 * Convierte una URL de Supabase Storage al endpoint de transform (CDN).
 * width en px, quality 1-100. SVGs y GIFs se devuelven sin transformar.
 */
export function getOptimizedUrl(url: string | null | undefined, width: number, quality = 80): string | null {
  if (!url) return null;
  if (!url.includes(".supabase.co/storage/v1/object/public/")) return url;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "svg" || ext === "gif") return url;
  const base = url.split("?")[0];
  const render = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return `${render}?width=${width}&quality=${quality}&resize=cover`;
}

/**
 * Fire-and-forget: pre-warms Supabase image transformation cache
 * for the most common display sizes (card + thumb).
 * Call this right after uploading a new image to Supabase.
 */
export function warmImageCache(publicUrl: string): void {
  if (!publicUrl.includes(".supabase.co/storage/v1/object/public/")) return;
  const base = publicUrl.split("?")[0];
  const render = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  [
    `${render}?width=500&quality=80&resize=cover`,
    `${render}?width=320&quality=75&resize=cover`,
  ].forEach(url => fetch(url, { method: "HEAD" }).catch(() => {}));
}
