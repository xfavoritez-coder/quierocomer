/**
 * Analytics for carta views using the existing StatEvent system.
 * Uses guestId (persistent) + sessionId (per-tab) from centralized lib.
 */
import { getGuestId, getSessionId } from "@/lib/guestId";
import { getDbSessionId } from "@/lib/sessionTracker";

function track(restaurantId: string, eventType: string, extra?: Record<string, unknown>) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, restaurantId, guestId: getGuestId(), sessionId: getSessionId(), dbSessionId: getDbSessionId(), ...extra }),
  }).catch(() => {});
}

export function trackCartaViewLoaded(restaurantId: string, view: string) {
  track(restaurantId, "SESSION_START");
}

export function trackCartaViewSelected(restaurantId: string, view: string, previousView: string) {
  track(restaurantId, "CARTA_VIEW_SELECTED");
}

export function trackCartaDishOpenedInList(restaurantId: string, dishId: string, isGeniePick: boolean) {
  track(restaurantId, "DISH_VIEW", { dishId });
}

export function trackCartaViajeCategoryReached(restaurantId: string, categoryId: string) {
  track(restaurantId, "CATEGORY_VIEW", { categoryId });
}

export function trackCartaDishOpenedInViaje(restaurantId: string, dishId: string, isGeniePick: boolean) {
  track(restaurantId, "DISH_VIEW", { dishId });
}

// ── New analytics events ──

export function trackSearchPerformed(restaurantId: string, query: string, resultsCount: number) {
  track(restaurantId, "SEARCH_PERFORMED", { query: query.toLowerCase().trim(), resultsCount });
}

export function trackSearchClicked(restaurantId: string, query: string, clickedResultId: string) {
  track(restaurantId, "SEARCH_PERFORMED", { query: query.toLowerCase().trim(), clickedResultId });
}

export function trackFilterApplied(restaurantId: string, filterType: string, filterValue: string, resultsCount: number) {
  track(restaurantId, "FILTER_APPLIED", { resultsCount, metadata: { filterType, filterValue } });
}

// ── Dish impression batching ──

let impressionBatch: { dishId: string; restaurantId: string; position: number; visibleMs: number }[] = [];
let impressionTimer: ReturnType<typeof setTimeout> | null = null;

function flushImpressions() {
  if (impressionBatch.length === 0) return;
  const batch = [...impressionBatch];
  impressionBatch = [];
  const sessionId = getSessionId();
  if (!sessionId) return;
  // Use sendBeacon for reliability on page close, fetch otherwise
  const payload = JSON.stringify({ sessionId, impressions: batch });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/qr/impressions", payload);
  } else {
    fetch("/api/qr/impressions", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  }
}

export function trackDishImpression(restaurantId: string, dishId: string, position: number, visibleMs: number) {
  impressionBatch.push({ dishId, restaurantId, position, visibleMs });
  if (impressionTimer) clearTimeout(impressionTimer);
  impressionTimer = setTimeout(flushImpressions, 10000); // flush every 10s
}

// Flush on page close
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushImpressions);
  window.addEventListener("beforeunload", flushImpressions);
}
