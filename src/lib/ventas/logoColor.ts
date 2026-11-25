import sharp from "sharp";

/** Color principal sugerido desde el logo: color dominante, evitando blancos/negros/grises. */
export async function suggestColorFromLogo(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).resize(48, 48, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 128) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 40 || max < 40 || min > 225) continue; // gris, negro o blanco
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const c = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      c.n++; c.r += r; c.g += g; c.b += b;
      buckets.set(key, c);
    }
    const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
    if (!best || best.n < 8) return null;
    const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, "0");
    return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
  } catch {
    return null;
  }
}
