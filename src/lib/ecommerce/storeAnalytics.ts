/**
 * Store e-commerce analytics — fire-and-forget tracking.
 * Reutiliza la infraestructura StatEvent del QR (misma tabla, mismos guestIds).
 */
import { getGuestId, getSessionId } from "@/lib/guestId";

function sendEvent(eventType: string, restaurantId: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    eventType,
    restaurantId,
    guestId: getGuestId(),
    sessionId: getSessionId(),
    metadata,
  });
  fetch("/api/qr/stat-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function sendBeaconEvent(eventType: string, restaurantId: string, metadata?: Record<string, unknown>) {
  if (typeof navigator === "undefined") return;
  const payload = JSON.stringify({
    eventType,
    restaurantId,
    guestId: getGuestId(),
    sessionId: getSessionId(),
    metadata,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/qr/stat-events", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/qr/stat-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  }
}

/** Entrada al store. 3s delay anti-bot — no queremos contar bots ni bounces inmediatos. */
export function trackStoreView(restaurantId: string) {
  if (typeof window === "undefined") return;
  setTimeout(() => sendEvent("STORE_VIEW", restaurantId), 3000);
}

/**
 * Usuario cerró el modal de detalle de un plato.
 * Se dispara al cierre (no al abrir) para incluir el tiempo de permanencia.
 * addedToCart=true si lo agregó al carrito durante esa vista.
 */
export function trackDishView(restaurantId: string, dishId: string, dishName: string, dwellMs?: number, addedToCart?: boolean) {
  sendEvent("STORE_DISH_VIEW", restaurantId, {
    dishId, dishName,
    ...(dwellMs != null ? { dwellMs } : {}),
    ...(addedToCart != null ? { addedToCart } : {}),
  });
}

/** Usuario agregó un producto al carrito. */
export function trackCartAdd(restaurantId: string, dishId: string, dishName: string, price: number) {
  sendEvent("STORE_CART_ADD", restaurantId, { dishId, dishName, price });
}

/** Usuario eliminó un producto del carrito. */
export function trackCartRemove(restaurantId: string, dishId: string, dishName: string) {
  sendEvent("STORE_CART_REMOVE", restaurantId, { dishId, dishName });
}

/** Usuario llegó a la pantalla de checkout. */
export function trackCheckoutStart(restaurantId: string, itemCount: number, subtotal: number) {
  sendEvent("STORE_CHECKOUT_START", restaurantId, { itemCount, subtotal });
}

/**
 * Usuario cerró o abandonó el checkout sin completar el pedido.
 * Incluye el contenido del carrito para saber exactamente qué dejó.
 * Usa sendBeacon para garantizar envío incluso al cerrar la pestaña.
 */
export function trackCheckoutAbandon(
  restaurantId: string,
  cartItems?: { name: string; unit_price: number; quantity: number }[]
) {
  sendBeaconEvent("STORE_CHECKOUT_ABANDON", restaurantId, cartItems?.length ? { cartItems } : undefined);
}

/** Pedido completado con éxito. */
export function trackOrderPlaced(restaurantId: string, orderId: string, total: number) {
  sendEvent("STORE_ORDER_PLACED", restaurantId, { orderId, total });
}

/**
 * Búsqueda en el store que no devolvió resultados.
 * Solo se dispara cuando hay query y 0 resultados (oportunidad de menú).
 */
export function trackSearch(restaurantId: string, query: string) {
  sendEvent("STORE_SEARCH", restaurantId, { query });
}

/** Usuario abrió el drawer del carrito (intención de revisar/comprar). */
export function trackCartView(restaurantId: string, itemCount: number, cartValue: number) {
  sendEvent("STORE_CART_VIEW", restaurantId, { itemCount, cartValue });
}

/**
 * Fin de sesión en el store sin haber comprado.
 * Usa sendBeacon — se dispara en beforeunload o al cerrar el modal de store.
 * sessionDurationMs: tiempo desde que entró al store.
 * dishesViewed: cantidad de fichas abiertas.
 * cartValue: total en carrito al salir ($0 si estaba vacío).
 */
export function trackSessionEnd(restaurantId: string, sessionDurationMs: number, dishesViewed: number, cartValue: number) {
  sendBeaconEvent("STORE_SESSION_END", restaurantId, { sessionDurationMs, dishesViewed, cartValue });
}

/**
 * Usuario scrolleó hasta una categoría (IntersectionObserver).
 * dwellMs: tiempo aproximado que pasó en esa sección antes de seguir.
 */
export function trackScrollCategory(restaurantId: string, categoryId: string, categoryName: string, dwellMs?: number) {
  sendEvent("STORE_SCROLL_CATEGORY", restaurantId, { categoryId, categoryName, ...(dwellMs != null ? { dwellMs } : {}) });
}

/**
 * Usuario intentó aplicar un cupón.
 * success=false si el cupón era inválido/expirado — punto frecuente de abandono.
 */
export function trackCouponAttempt(restaurantId: string, code: string, success: boolean, reason?: string) {
  sendEvent("STORE_COUPON_ATTEMPT", restaurantId, { code, success, ...(reason ? { reason } : {}) });
}

/**
 * Usuario abrió la selección de modificadores de un plato.
 * Señal de alta intención: casi siempre precede un cart_add.
 */
export function trackModifierOpen(restaurantId: string, dishId: string, dishName: string) {
  sendEvent("STORE_MODIFIER_OPEN", restaurantId, { dishId, dishName });
}
