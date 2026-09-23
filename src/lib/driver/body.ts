import { NextRequest } from "next/server";

/**
 * Lee el body de una petición de la app de repartidor de forma tolerante:
 * acepta JSON y application/x-www-form-urlencoded (la app envía algunas
 * acciones como form-urlencoded, herencia del backend PHP anterior).
 * Nunca lanza: si no puede parsear, devuelve {}.
 */
export async function readDriverBody(req: NextRequest): Promise<Record<string, any>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      return (await req.json()) as Record<string, any>;
    }
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const obj: Record<string, any> = {};
      fd.forEach((v, k) => { obj[k] = typeof v === "string" ? v : v; });
      return obj;
    }
    // Content-type desconocido/ausente: intenta JSON y, si falla, querystring.
    const txt = await req.text();
    if (!txt) return {};
    try {
      return JSON.parse(txt);
    } catch {
      const params = new URLSearchParams(txt);
      const obj: Record<string, any> = {};
      params.forEach((v, k) => { obj[k] = v; });
      return obj;
    }
  } catch {
    return {};
  }
}
