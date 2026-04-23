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

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds (optimized for concurrent load)
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

interface ViewEntry {
  view: string;
  startedAt: number;
  durationMs: number;
}

interface SessionData {
  restaurantId: string;
  tableId?: string;
  dbSessionId: string | null;
  startedAt: number;
  viewUsed: string | null;
  viewHistory: ViewEntry[];
  currentViewStart: number;
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
let activityBound = false;
let startingSession = false; // prevent duplicate start calls

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

  // Flush current view time into history
  const history = [...session.viewHistory];
  if (session.viewUsed) {
    const elapsed = Date.now() - session.currentViewStart;
    const existing = history.find(v => v.view === session!.viewUsed);
    if (existing) {
      existing.durationMs += elapsed;
    } else {
      history.push({ view: session.viewUsed, startedAt: session.currentViewStart, durationMs: elapsed });
    }
  }

  // Collect localStorage preferences (Genio data)
  let preferences: any = null;
  if (typeof window !== "undefined") {
    const diet = localStorage.getItem("qr_diet");
    const restrictions = localStorage.getItem("qr_restrictions");
    const dislikes = localStorage.getItem("qr_dislikes");
    if (diet || restrictions || dislikes) {
      preferences = {
        ...(diet && { dietType: diet }),
        ...(restrictions && { restrictions: JSON.parse(restrictions) }),
        ...(dislikes && { dislikes: JSON.parse(dislikes) }),
      };
    }
  }

  return {
    sessionId: session.dbSessionId,
    durationMs: Date.now() - session.startedAt,
    preferences,
    viewUsed: session.viewUsed,
    viewHistory: history.map(v => ({ view: v.view, durationMs: v.durationMs })),
    dishesViewed: Array.from(session.dishDwells.values()),
    categoriesViewed: Array.from(session.categoryDwells.values()),
    pickedDishId: session.pickedDishId,
    isFinal,
  };
}

function sendHeartbeat(isFinal = false, closeReason?: string) {
  const payload = getPayload(isFinal);
  if (!payload || !payload.sessionId) return;
  if (closeReason) (payload as any).closeReason = closeReason;

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
  if (startingSession) return; // prevent double-call from React StrictMode

  // Close previous session if switching restaurants
  if (session && !session.closed) {
    closeSession("new_session");
  }

  startingSession = true;
  deviceType = getDeviceType();

  const newSession: SessionData = {
    restaurantId,
    tableId,
    dbSessionId: null,
    startedAt: Date.now(),
    viewUsed: null,
    viewHistory: [],
    currentViewStart: Date.now(),
    dishDwells: new Map(),
    categoryDwells: new Map(),
    pickedDishId: null,
    closed: false,
  };
  session = newSession;

  // Create session in DB immediately, THEN start heartbeat
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
      startingSession = false;
      // Use captured reference to avoid race conditions
      if (newSession === session && data.sessionId) {
        newSession.dbSessionId = data.sessionId;
        // Start heartbeat ONLY after we have the DB session ID
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL);
      }
    })
    .catch(() => { startingSession = false; });

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

  if (!activityBound) {
    bindActivityListeners();
    activityBound = true;
  }
  resetInactivityTimer();
}

/** Track which view the user selected */
export function trackViewSelected(view: string) {
  if (!session) return;
  // Close previous view's time
  if (session.viewUsed && session.viewUsed !== view) {
    const elapsed = Date.now() - session.currentViewStart;
    const existing = session.viewHistory.find(v => v.view === session!.viewUsed);
    if (existing) {
      existing.durationMs += elapsed;
    } else {
      session.viewHistory.push({ view: session.viewUsed, startedAt: session.currentViewStart, durationMs: elapsed });
    }
  }
  session.viewUsed = view;
  session.currentViewStart = Date.now();
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
  startingSession = false;

  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  const durationMs = Date.now() - session.startedAt;
  if (durationMs < 2000) return; // Skip accidental sessions

  if (session.dbSessionId) {
    sendHeartbeat(true, reason);
  }
}
