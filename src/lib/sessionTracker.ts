/**
 * Session Tracker — collects user behavior during a carta visit.
 * Tracks dish dwell times, category views, and sends a summary on close.
 * Detects inactivity (30s) to auto-close the session.
 */
import { getGuestId, getSessionId } from "./guestId";

const INACTIVITY_TIMEOUT = 30_000; // 30 seconds
const DWELL_THRESHOLD = 3_000; // 3 seconds to count as "viewed"

interface DishDwell {
  dishId: string;
  dwellMs: number;
  startedAt: number;
}

interface CategoryDwell {
  categoryId: string;
  dwellMs: number;
}

interface SessionData {
  restaurantId: string;
  tableId?: string;
  startedAt: number;
  viewUsed: string | null;
  dishDwells: Map<string, DishDwell>;
  categoryDwells: Map<string, CategoryDwell>;
  pickedDishId: string | null;
  closed: boolean;
}

let session: SessionData | null = null;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let currentDishId: string | null = null;
let currentDishStart: number | null = null;
let deviceType: string | null = null;

function getDeviceType(): string {
  if (typeof window === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    closeSession("inactivity");
  }, INACTIVITY_TIMEOUT);
}

function bindActivityListeners() {
  if (typeof window === "undefined") return;
  const reset = () => resetInactivityTimer();
  window.addEventListener("touchstart", reset, { passive: true });
  window.addEventListener("scroll", reset, { passive: true });
  window.addEventListener("click", reset, { passive: true });
  // Also close on page hide (tab close, navigate away)
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") closeSession("pagehide");
  });
  window.addEventListener("beforeunload", () => closeSession("beforeunload"));
}

/** Start tracking a session for a restaurant */
export function startSession(restaurantId: string, tableId?: string) {
  if (session && session.restaurantId === restaurantId && !session.closed) return;

  session = {
    restaurantId,
    tableId,
    startedAt: Date.now(),
    viewUsed: null,
    dishDwells: new Map(),
    categoryDwells: new Map(),
    pickedDishId: null,
    closed: false,
  };
  deviceType = getDeviceType();

  // Fire SESSION_START event
  sendEvent("SESSION_START", restaurantId);

  bindActivityListeners();
  resetInactivityTimer();
}

/** Track which view the user selected */
export function trackViewSelected(view: string) {
  if (!session) return;
  session.viewUsed = view;
  sendEvent("CARTA_VIEW_SELECTED", session.restaurantId);
}

/** Call when a dish becomes visible (e.g., scrolled into view) */
export function trackDishEnter(dishId: string) {
  if (!session) return;
  // Flush previous dish
  flushCurrentDish();
  currentDishId = dishId;
  currentDishStart = Date.now();
  resetInactivityTimer();
}

/** Call when a dish leaves view */
export function trackDishLeave() {
  flushCurrentDish();
}

function flushCurrentDish() {
  if (!session || !currentDishId || !currentDishStart) return;
  const elapsed = Date.now() - currentDishStart;

  const existing = session.dishDwells.get(currentDishId);
  if (existing) {
    existing.dwellMs += elapsed;
  } else {
    session.dishDwells.set(currentDishId, {
      dishId: currentDishId,
      dwellMs: elapsed,
      startedAt: currentDishStart,
    });
  }

  // If they spent 3+ seconds, fire a DISH_DWELL event (once per dish per session)
  const total = session.dishDwells.get(currentDishId)!;
  if (total.dwellMs >= DWELL_THRESHOLD && elapsed >= DWELL_THRESHOLD) {
    sendEvent("DISH_DWELL", session.restaurantId, currentDishId);
  }

  currentDishId = null;
  currentDishStart = null;
}

/** Track category viewing time */
export function trackCategoryDwell(categoryId: string, dwellMs: number) {
  if (!session) return;
  const existing = session.categoryDwells.get(categoryId);
  if (existing) {
    existing.dwellMs += dwellMs;
  } else {
    session.categoryDwells.set(categoryId, { categoryId, dwellMs });
  }
}

/** Track when user picks a dish (e.g., from Genio) */
export function trackDishPicked(dishId: string) {
  if (!session) return;
  session.pickedDishId = dishId;
}

/** Close session and send summary to server */
export function closeSession(reason: string = "manual") {
  if (!session || session.closed) return;
  session.closed = true;
  flushCurrentDish();

  if (inactivityTimer) clearTimeout(inactivityTimer);

  const durationMs = Date.now() - session.startedAt;

  // Don't send sessions shorter than 2 seconds (bot/accidental)
  if (durationMs < 2000) return;

  const payload = {
    guestId: getGuestId(),
    sessionId: getSessionId(),
    restaurantId: session.restaurantId,
    tableId: session.tableId || null,
    durationMs,
    viewUsed: session.viewUsed,
    deviceType,
    dishesViewed: Array.from(session.dishDwells.values()).map(d => ({
      dishId: d.dishId,
      dwellMs: d.dwellMs,
    })),
    categoriesViewed: Array.from(session.categoryDwells.values()),
    pickedDishId: session.pickedDishId,
    closeReason: reason,
  };

  // Use sendBeacon for reliability on page close
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/qr/sessions/close", JSON.stringify(payload));
  } else {
    fetch("/api/qr/sessions/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

/** Fire a single stat event (for events that don't need batching) */
function sendEvent(eventType: string, restaurantId: string, dishId?: string) {
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType,
      restaurantId,
      dishId: dishId || null,
      guestId: getGuestId(),
      sessionId: getSessionId(),
    }),
  }).catch(() => {});
}
