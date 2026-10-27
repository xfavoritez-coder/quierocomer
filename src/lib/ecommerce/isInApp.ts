// ¿El storefront corre dentro de la app nativa (WebView de Capacitor)?
// El runtime nativo inyecta `window.Capacitor` aunque la web no bundlee
// @capacitor/core, así que basta con detectar ese objeto. Se usa para habilitar
// cupones "solo app" (ver Coupon.appOnly): el cliente manda `fromApp` al validar
// y al hacer checkout, y el servidor lo exige si el cupón es solo-app.
export function isInApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap) return false;
  try {
    return typeof cap.isNativePlatform === "function" ? cap.isNativePlatform() : true;
  } catch {
    return true;
  }
}
