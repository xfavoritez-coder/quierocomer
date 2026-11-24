// Puente a los EVENTOS DE APP de Facebook (Meta) cuando el storefront corre
// dentro de la app nativa (WebView de Capacitor). El plugin nativo `FacebookEvents`
// (ver repo handroll-app) expone estos métodos vía window.Capacitor.Plugins.
//
// Sirve para que Meta reciba la COMPRA como evento de APP (no solo web) → habilita
// campañas de "Promoción de la aplicación". La instalación/activación las registra
// el SDK nativo solo. En la web (fuera de la app) estas funciones son no-op.
import { isInApp } from "./isInApp";

type FacebookEventsPlugin = {
  logPurchase?: (opts: { amount: number; currency: string; orderId?: string }) => Promise<unknown>;
  logEvent?: (opts: { name: string; valueToSum?: number; params?: Record<string, string> }) => Promise<unknown>;
  requestTracking?: () => Promise<{ status: string }>;
};

function plugin(): FacebookEventsPlugin | null {
  if (!isInApp()) return null;
  try {
    const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
    const p = cap?.Plugins?.FacebookEvents as FacebookEventsPlugin | undefined;
    return p ?? null;
  } catch {
    return null;
  }
}

/** Registra una compra como evento de app de Facebook (solo dentro de la app). */
export function fbAppLogPurchase(amount: number, orderId?: string): void {
  const p = plugin();
  if (!p?.logPurchase || !(amount > 0)) return;
  try {
    void p.logPurchase({ amount, currency: "CLP", orderId }).catch(() => {});
  } catch { /* no-op */ }
}

/** Pide el permiso ATT de iOS (una vez, al abrir la app). No-op fuera de la app. */
export function fbAppRequestTracking(): void {
  const p = plugin();
  if (!p?.requestTracking) return;
  try {
    void p.requestTracking().catch(() => {});
  } catch { /* no-op */ }
}
