/**
 * Analytics for carta views using the existing StatEvent system.
 * Uses guestId (persistent) + sessionId (per-tab) from centralized lib.
 */
import { getGuestId, getSessionId } from "@/lib/guestId";

function track(restaurantId: string, eventType: string, dishId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, dishId, guestId: getGuestId(), sessionId: getSessionId() }),
  }).catch(() => {});
}

export function trackCartaViewLoaded(restaurantId: string, view: string) {
  track(restaurantId, "SESSION_START");
}

export function trackCartaViewSelected(restaurantId: string, view: string, previousView: string) {
  track(restaurantId, "CARTA_VIEW_SELECTED");
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
