/**
 * Session Tracker v3 — Deferred creation, heartbeat every 15s, close on exit.
 *
 * Flow:
 * 1. User enters carta → in-memory session created (no DB call yet)
 * 2. First real interaction (touch/click) → POST /sessions/start → creates Session in DB
 * 3. Every 15s of activity → PATCH /sessions/heartbeat → updates accumulated data
 * 4. On exit (tab close, inactivity) → final PATCH with endedAt
 *
 * Bots and zero-interaction visits never create a DB session.
 */
import { getGuestId, getSessionId } from "./guestId";

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds (optimized for concurrent load)
const INACTIVITY_TIMEOUT = 30_000; // 30 seconds
const DWELL_THRESHOLD = 3_000; // 3 seconds to count as "viewed"

interface DishDwell {
  dishId: string;
  dwellMs: number;
  detailMs?: number;
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
  cartaLang: string | null;
  closed: boolean;
}

let session: SessionData | null = null;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentDishId: string | null = null;
let currentDishStart: number | null = null;
let detailDishId: string | null = null;
let detailStart: number | null = null;
let lastRestaurantId: string | undefined;
let lastTableId: string | undefined;
let lastIsQrScan: boolean | undefined;
let deviceType: string | null = null;
let activityBound = false;
let startingSession = false; // prevent duplicate start calls
let creatingDbSession = false; // prevent duplicate DB session creation
let hadUserInteraction = false; // true after real touch/click

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

function markInteraction() {
  if (!hadUserInteraction) {
    hadUserInteraction = true;
    // Create DB session immediately on first interaction (don't wait 15s)
    ensureDbSession();
    // Start heartbeat timer for periodic updates
    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL);
    }
  }
}

function bindActivityListeners() {
  if (typeof window === "undefined") return;
  const reset = () => resetInactivityTimer();
  window.addEventListener("touchstart", () => { markInteraction(); reset(); }, { passive: true });
  window.addEventListener("scroll", () => { markInteraction(); reset(); }, { passive: true });
  window.addEventListener("mousemove", () => { markInteraction(); reset(); }, { passive: true });
  window.addEventListener("click", () => { markInteraction(); reset(); }, { passive: true });
  let hiddenAt: number | null = null;
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      // Send heartbeat but don't close — just pause
      if (session?.dbSessionId) sendHeartbeat(false);
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    } else if (document.visibilityState === "visible") {
      if (!lastRestaurantId) return;
      const awayMs = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;

      if (awayMs > 5 * 60_000) {
        // Away > 5 min — close old session, start fresh
        if (session && !session.closed) closeSession("pagehide");
        const tryStart = () => {
          if (startingSession) { setTimeout(tryStart, 200); return; }
          startSession(lastRestaurantId!, lastTableId, lastIsQrScan);
        };
        tryStart();
      } else if (session && !session.closed && session.dbSessionId) {
        // Away < 5 min — resume: restart heartbeat and inactivity timer
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL);
        resetInactivityTimer();
      }
    }
  });
  window.addEventListener("beforeunload", () => closeSession("beforeunload"));
}

function getPayload(isFinal: boolean) {
  if (!session) return null;
  flushCurrentDish();
  flushDetail();

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
    cartaLang: session.cartaLang,
    isFinal,
  };
}

let pendingFinalHeartbeat: { closeReason?: string } | null = null;

function sendHeartbeat(isFinal = false, closeReason?: string) {
  // Create DB session on first heartbeat if user interacted
  if (hadUserInteraction && session && !session.dbSessionId && !creatingDbSession) {
    if (isFinal) pendingFinalHeartbeat = { closeReason };
    ensureDbSession();
    return; // dbSessionId not available yet — ensureDbSession will send pending heartbeat
  }
  // Still creating DB session — queue final heartbeat for when it completes
  if (creatingDbSession && !session?.dbSessionId) {
    if (isFinal) pendingFinalHeartbeat = { closeReason };
    return;
  }
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

/** Create the DB session on first real interaction (deferred from startSession) */
function ensureDbSession() {
  if (!session || session.dbSessionId || session.closed || creatingDbSession) return;
  creatingDbSession = true;

  const currentSession = session;
  fetch("/api/qr/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestId: getGuestId(),
      restaurantId: currentSession.restaurantId,
      tableId: currentSession.tableId || null,
      deviceType,
      externalReferer: document.referrer || null,
      isQrScan: lastIsQrScan || false,
    }),
  })
    .then(r => {
      if (!r.ok) throw new Error(`Session start failed: ${r.status}`);
      return r.json();
    })
    .then(data => {
      creatingDbSession = false;
      if (!data.sessionId) return;
      const target = currentSession === session ? currentSession : session;
      if (target && !target.dbSessionId) {
        target.dbSessionId = data.sessionId;
        // Flush any pending final heartbeat that was queued during creation
        if (pendingFinalHeartbeat) {
          const { closeReason } = pendingFinalHeartbeat;
          pendingFinalHeartbeat = null;
          sendHeartbeat(true, closeReason);
        } else {
          // Send first heartbeat immediately with accumulated data
          sendHeartbeat(false);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL);
        }
      }
    })
    .catch(err => { creatingDbSession = false; pendingFinalHeartbeat = null; console.error("[QC] Session start error:", err); });
}

/** Start tracking a session for a restaurant */
const SESSION_MAX_AGE = 30 * 60_000; // 30 minutes — after this, create a fresh session
export function startSession(restaurantId: string, tableId?: string, isQrScan?: boolean) {
  lastRestaurantId = restaurantId;
  lastTableId = tableId;
  lastIsQrScan = isQrScan;
  if (session && session.restaurantId === restaurantId && !session.closed) {
    const age = Date.now() - session.startedAt;
    if (age < SESSION_MAX_AGE) return; // still fresh, skip
    closeSession("stale");
  }
  if (startingSession) return;

  if (session && !session.closed) {
    closeSession("new_session");
  }

  startingSession = true;
  deviceType = getDeviceType();
  creatingDbSession = false;
  hadUserInteraction = false;

  session = {
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
    cartaLang: pendingLang,
    closed: false,
  };
  startingSession = false;

  // DB session creation deferred to first real interaction (ensureDbSession)

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
        dbSessionId: session.dbSessionId,
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

/** Get the DB session ID (available after session start completes) */
export function getDbSessionId(): string | null {
  return session?.dbSessionId ?? null;
}

/** Set the language the carta was displayed in */
let pendingLang: string | null = null;
export function setCartaLang(lang: string) {
  pendingLang = lang;
  if (session) session.cartaLang = lang;
}

/** Track when user picks a dish */
export function trackDishPicked(dishId: string) {
  if (!session) return;
  ensureDbSession();
  session.pickedDishId = dishId;
}

/** Track when user opens dish detail modal */
export function trackDetailOpen(dishId: string) {
  flushDetail();
  detailDishId = dishId;
  detailStart = Date.now();
}

/** Track when user closes dish detail modal */
export function trackDetailClose() {
  flushDetail();
}

function flushDetail() {
  if (!session || !detailDishId || !detailStart) return;
  const elapsed = Date.now() - detailStart;
  const existing = session.dishDwells.get(detailDishId);
  if (existing) {
    existing.detailMs = (existing.detailMs || 0) + elapsed;
  } else {
    session.dishDwells.set(detailDishId, { dishId: detailDishId, dwellMs: 0, detailMs: elapsed });
  }
  detailDishId = null;
  detailStart = null;
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

  if (session.dbSessionId || creatingDbSession || hadUserInteraction) {
    sendHeartbeat(true, reason);
  }
}
