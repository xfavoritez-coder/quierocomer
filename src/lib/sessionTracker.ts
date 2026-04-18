/**
 * Session Tracker v2 — Create on enter, heartbeat every 15s, close on exit.
 *
 * Flow:
 * 1. User enters carta → POST /sessions/start → creates Session in DB immediately
 * 2. Every 15s of activity → PATCH /sessions/heartbeat → updates accumulated data
 * 3. On exit (tab close, inactivity) → final PATCH with endedAt
 *
 * Even if the final PATCH never arrives, we have data from the last heartbeat.
 */
import { getGuestId, getSessionId } from "./guestId";

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds
const INACTIVITY_TIMEOUT = 30_000; // 30 seconds
const DWELL_THRESHOLD = 3_000; // 3 seconds to count as "viewed"

interface DishDwell {
  dishId: string;
  dwellMs: number;
}

interface CategoryDwell {
  categoryId: string;
  dwellMs: number;
}

interface SessionData {
  restaurantId: string;
  tableId?: string;
  dbSessionId: string | null; // ID from the DB after creation
  startedAt: number;
  viewUsed: string | null;
  dishDwells: Map<string, DishDwell>;
  categoryDwells: Map<string, CategoryDwell>;
  pickedDishId: string | null;
  closed: boolean;
}

let session: SessionData | null = null;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
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
  inactivityTimer = setTimeout(() => closeSession("inactivity"), INACTIVITY_TIMEOUT);
}

function bindActivityListeners() {
  if (typeof window === "undefined") return;
  const reset = () => resetInactivityTimer();
  window.addEventListener("touchstart", reset, { passive: true });
  window.addEventListener("scroll", reset, { passive: true });
  window.addEventListener("click", reset, { passive: true });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") closeSession("pagehide");
  });
  window.addEventListener("beforeunload", () => closeSession("beforeunload"));
}

function getPayload(isFinal: boolean) {
  if (!session) return null;
  flushCurrentDish();
  return {
    sessionId: session.dbSessionId,
    durationMs: Date.now() - session.startedAt,
    viewUsed: session.viewUsed,
    dishesViewed: Array.from(session.dishDwells.values()),
    categoriesViewed: Array.from(session.categoryDwells.values()),
    pickedDishId: session.pickedDishId,
    isFinal,
  };
}

function sendHeartbeat(isFinal = false) {
  const payload = getPayload(isFinal);
  if (!payload || !payload.sessionId) return;

  const body = JSON.stringify(payload);

  if (isFinal && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/qr/sessions/heartbeat", blob);
  } else {
    fetch("/api/qr/sessions/heartbeat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: isFinal,
    }).catch(() => {});
  }
}

/** Start tracking a session for a restaurant */
export function startSession(restaurantId: string, tableId?: string) {
  if (session && session.restaurantId === restaurantId && !session.closed) return;

  deviceType = getDeviceType();

  session = {
    restaurantId,
    tableId,
    dbSessionId: null,
    startedAt: Date.now(),
    viewUsed: null,
    dishDwells: new Map(),
    categoryDwells: new Map(),
    pickedDishId: null,
    closed: false,
  };

  // Create session in DB immediately
  fetch("/api/qr/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestId: getGuestId(),
      restaurantId,
      tableId: tableId || null,
      deviceType,
    }),
  })
    .then(r => r.json())
    .then(data => {
      if (session && data.sessionId) {
        session.dbSessionId = data.sessionId;
      }
    })
    .catch(() => {});

  // Fire SESSION_START stat event
  fetch("/api/qr/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "SESSION_START",
      restaurantId,
      guestId: getGuestId(),
      sessionId: getSessionId(),
    }),
  }).catch(() => {});

  // Start heartbeat every 15s
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL);

  bindActivityListeners();
  resetInactivityTimer();
}

/** Track which view the user selected */
export function trackViewSelected(view: string) {
  if (!session) return;
  session.viewUsed = view;
}

/** Call when a dish becomes visible */
export function trackDishEnter(dishId: string) {
  if (!session) return;
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
    session.dishDwells.set(currentDishId, { dishId: currentDishId, dwellMs: elapsed });
  }

  // Fire DISH_DWELL stat event if 3s+ (once per dish)
  const total = session.dishDwells.get(currentDishId)!;
  if (total.dwellMs >= DWELL_THRESHOLD && elapsed >= DWELL_THRESHOLD) {
    fetch("/api/qr/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "DISH_DWELL",
        restaurantId: session.restaurantId,
        dishId: currentDishId,
        guestId: getGuestId(),
        sessionId: getSessionId(),
      }),
    }).catch(() => {});
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

/** Track when user picks a dish */
export function trackDishPicked(dishId: string) {
  if (!session) return;
  session.pickedDishId = dishId;
}

/** Close session — final heartbeat */
export function closeSession(reason: string = "manual") {
  if (!session || session.closed) return;
  session.closed = true;

  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  const durationMs = Date.now() - session.startedAt;
  if (durationMs < 2000) return; // Skip accidental sessions

  sendHeartbeat(true); // Final update with endedAt
}
