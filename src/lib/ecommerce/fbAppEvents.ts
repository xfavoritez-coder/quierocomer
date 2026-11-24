// Puente a los EVENTOS DE APP de Facebook (Meta) cuando el storefront corre
// dentro de la app nativa (WebView de Capacitor). El plugin nativo `FacebookEvents`
// (ver repo handroll-app) expone estos métodos.
//
// IMPORTANTE: la web remota (handroll.cl) NO bundlea @capacitor/core, así que
// `Capacitor.Plugins.FacebookEvents` NO está poblado para plugins propios. Hay que
// usar el bridge de bajo nivel `Capacitor.nativePromise(plugin, método, args)` que
// sí está siempre inyectado y enruta por nombre de plugin (mismo patrón que el
// plugin OrderActivity de la Isla Dinámica). Dejamos fallback a Plugins por si
// estuviera. Sin esto, las llamadas JS→nativo (ATT, compra) nunca llegaban al SDK.
//
// Sirve para que Meta reciba la COMPRA como evento de APP (no solo web) → habilita
// campañas de "Promoción de la aplicación". La instalación/activación las registra
// el SDK nativo solo (sin pasar por este puente). Fuera de la app es no-op.
import { isInApp } from "./isInApp";

/* eslint-disable @typescript-eslint/no-explicit-any */
function getCap(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).Capacitor ?? null;
}

/** Llama un método del plugin nativo FacebookEvents. No-op fuera de la app. */
function call(method: string, args: Record<string, unknown>): void {
  if (!isInApp()) return;
  const cap = getCap();
  if (!cap) return;
  try {
    // 1) Si Plugins estuviera poblado (poco probable en la web remota), úsalo.
    const p = cap.Plugins?.FacebookEvents;
    if (p && typeof p[method] === "function") {
      Promise.resolve(p[method](args)).catch(() => {});
      return;
    }
    // 2) Bridge de bajo nivel (siempre inyectado): enruta por nombre de plugin.
    if (typeof cap.nativePromise === "function") {
      Promise.resolve(cap.nativePromise("FacebookEvents", method, args)).catch(() => {});
    }
  } catch {
    /* no-op */
  }
}

/** Registra una compra como evento de app de Facebook (solo dentro de la app). */
export function fbAppLogPurchase(amount: number, orderId?: string): void {
  if (!(amount > 0)) return;
  call("logPurchase", { amount, currency: "CLP", orderId });
}

/** Pide el permiso ATT de iOS (una vez, al abrir la app). No-op fuera de la app. */
export function fbAppRequestTracking(): void {
  call("requestTracking", {});
}
