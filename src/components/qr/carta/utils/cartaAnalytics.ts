/**
 * Analytics for carta views using the existing StatEvent system.
 * Uses sessionId from sessionStorage (same as Genio tracking).
 */

function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("qr_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("qr_session_id", id);
  }
  return id;
}

function track(restaurantId: string, eventType: string, dishId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId, sessionId: getSessionId() }),
  }).catch(() => {});
}

export function trackCartaViewLoaded(restaurantId: string, view: string) {
  // Reuse QR_SCAN as a view-loaded proxy for now (no schema migration needed)
  track(restaurantId, "QR_SCAN");
}

export function trackCartaViewSelected(restaurantId: string, view: string, previousView: string) {
  // Track as CATEGORY_VIEW with the view name as context
  track(restaurantId, "CATEGORY_VIEW");
}

export function trackCartaDishOpenedInList(restaurantId: string, dishId: string, isGeniePick: boolean) {
  track(restaurantId, "DISH_VIEW", dishId);
}

export function trackCartaViajeCategoryReached(restaurantId: string, categoryId: string) {
  track(restaurantId, "CATEGORY_VIEW");
}

export function trackCartaDishOpenedInViaje(restaurantId: string, dishId: string, isGeniePick: boolean) {
  track(restaurantId, "DISH_VIEW", dishId);
}
