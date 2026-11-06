import { headers, cookies } from "next/headers";

/**
 * Token que la app nativa (Capacitor) agrega al User-Agent vía `appendUserAgent`
 * en capacitor.config.ts (repo handroll-app). Permite al servidor saber, ya en el
 * PRIMER render, que la request viene desde la app — sin cookie ni refresh.
 */
export const APP_UA_TOKEN = "QuieroComerApp";

/**
 * ¿La request (en el servidor) viene desde la app nativa?
 * - User-Agent con el token → inmediato, funciona en el primer render (preferido).
 * - Cookie `qc_app` → fallback (la setea <AppFlagSync/>; útil si el UA no llega,
 *   p. ej. PWA instalada en el home, o apps viejas sin el token).
 * Se usa para mostrar los platos `appOnly` (exclusivos de la app).
 */
export async function requestIsFromApp(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") || "";
  if (ua.includes(APP_UA_TOKEN)) return true;
  return (await cookies()).get("qc_app")?.value === "1";
}
