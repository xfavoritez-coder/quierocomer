import { headers } from "next/headers";

// Dominio principal de la app (el resto son dominios propios de locales).
const MAIN_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "quierocomer.com").toLowerCase();

/** Host público de la request, sin puerto ni `www.`, en minúsculas (o null). */
export async function currentHost(): Promise<string | null> {
  const h = await headers();
  const raw = (h.get("host") || "").split(":")[0].toLowerCase();
  if (!raw) return null;
  return raw.replace(/^www\./, "");
}

/** ¿El host pertenece a la app principal (quierocomer.com / *.vercel.app / local)? */
export function isMainHost(host: string | null): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  return host === MAIN_DOMAIN;
}
