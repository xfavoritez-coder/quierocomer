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

/** Entrada al store. 3s delay anti-bot — no queremos contar bots ni bounces inmediatos. */
export function trackStoreView(restaurantId: string) {
  if (typeof window === "undefined") return;
  setTimeout(() => sendEvent("STORE_VIEW", restaurantId), 3000);
}

/**
 * Usuario cerró el modal de detalle de un plato.
 * Se dispara al cierre (no al abrir) para incluir el tiempo de permanencia.
 */
export function trackDishView(restaurantId: string, dishId: string, dishName: string, dwellMs?: number) {
  sendEvent("STORE_DISH_VIEW", restaurantId, { dishId, dishName, ...(dwellMs != null ? { dwellMs } : {}) });
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
  if (typeof navigator === "undefined") return;
  const payload = JSON.stringify({
    eventType: "STORE_CHECKOUT_ABANDON",
    restaurantId,
    guestId: getGuestId(),
    sessionId: getSessionId(),
    metadata: cartItems?.length ? { cartItems } : undefined,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/qr/stat-events", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/qr/stat-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  }
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
