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
  // keepalive: true para que sobreviva al cierre de página (checkout abandon, etc.)
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

/** Usuario abrió el modal de detalle de un plato en el store. */
export function trackDishView(restaurantId: string, dishId: string, dishName: string) {
  sendEvent("STORE_DISH_VIEW", restaurantId, { dishId, dishName });
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
 * Usa sendBeacon para garantizar envío incluso al cerrar la pestaña.
 */
export function trackCheckoutAbandon(restaurantId: string) {
  if (typeof navigator === "undefined") return;
  const payload = JSON.stringify({
    eventType: "STORE_CHECKOUT_ABANDON",
    restaurantId,
    guestId: getGuestId(),
    sessionId: getSessionId(),
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
