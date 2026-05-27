/**
 * Universal visitor tracker — captures all visitor behavior (organic + paid).
 * Reuses the AdSession model for storage. Works on all pages.
 *
 * Call initVisitorTracker() on page mount. Unlike adTracker (UTM-only),
 * this tracks ALL visitors so we know what they did before activating.
 */

let sessionId: string | null = null;
let events: { ts: number; type: string; data?: any }[] = [];
let startTime = 0;
let maxScroll = 0;
let interactions = 0;
let sectionsViewed = new Set<string>();
let flushing = false;
let initialized = false;

function genSessionId() {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || (params.get("fbclid") ? "facebook" : params.get("gclid") ? "google" : "organic"),
    utmMedium: params.get("utm_medium") || (params.get("fbclid") ? "paid" : params.get("gclid") ? "cpc" : "direct"),
    utmCampaign: params.get("utm_campaign") || null,
    utmContent: params.get("utm_content") || null,
    utmTerm: params.get("utm_term") || null,
    fbclid: params.get("fbclid") || null,
  };
}

function pushEvent(type: string, data?: any, countAsInteraction = false) {
  events.push({ ts: Date.now() - startTime, type, data });
  if (countAsInteraction) interactions++;
}

function flush(final = false) {
  if (flushing || !sessionId) return;
  if (events.length === 0 && !final) return;
  flushing = true;

  const payload = {
    sessionId,
    duration: Math.round((Date.now() - startTime) / 1000),
    maxScroll,
    interactions,
    sectionsViewed: Array.from(sectionsViewed),
    events: events.splice(0),
    exitPage: final ? window.location.pathname : undefined,
    bounced: interactions <= 1 && Math.round((Date.now() - startTime) / 1000) < 10,
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  if (final && navigator.sendBeacon) {
    navigator.sendBeacon("/api/funnel/ad-event", blob);
    flushing = false;
  } else {
    fetch("/api/funnel/ad-event", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), keepalive: true,
    }).catch(() => {}).finally(() => { flushing = false; });
  }
}

function trackScroll() {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  if (h <= 0) return;
  const pct = Math.round((window.scrollY / h) * 100);
  if (pct > maxScroll) {
    const prev = maxScroll;
    maxScroll = pct;
    for (const m of [25, 50, 75, 100]) {
      if (prev < m && maxScroll >= m) pushEvent("scroll_milestone", { pct: m }, true);
    }
  }
}

function trackSections() {
  document.querySelectorAll("section[aria-label], section[data-section], [data-track]").forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const name = el.getAttribute("aria-label") || el.getAttribute("data-section") || el.getAttribute("data-track") || "unknown";
      if (!sectionsViewed.has(name)) {
        sectionsViewed.add(name);
        pushEvent("section_view", { section: name }, true);
      }
    }
  });
}

export function initVisitorTracker() {
  if (initialized || typeof window === "undefined") return;

  // Check if already have a session from this visit
  const stored = sessionStorage.getItem("visitor_session");
  if (stored) {
    try {
      const data = JSON.parse(stored);
      sessionId = data.sessionId;
      initialized = true;
      startTime = Date.now();
      pushEvent("page_view", { page: window.location.pathname });
      setupListeners();
      return;
    } catch {}
  }

  initialized = true;
  sessionId = genSessionId();
  startTime = Date.now();

  const utms = getUtmParams();
  sessionStorage.setItem("visitor_session", JSON.stringify({ sessionId, ...utms }));

  // Register session
  fetch("/api/funnel/ad-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      ...utms,
      landingPage: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    }),
    keepalive: true,
  }).catch(() => {});

  pushEvent("page_view", { page: window.location.pathname });
  setupListeners();
}

function setupListeners() {
  let scrollRAF: number | null = null;
  window.addEventListener("scroll", () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => { trackScroll(); trackSections(); scrollRAF = null; });
  }, { passive: true });

  document.addEventListener("click", e => {
    const target = e.target as HTMLElement;
    const closest = target.closest("a, button, [role='button']");
    if (closest) {
      pushEvent("click", {
        label: closest.textContent?.trim().slice(0, 60),
        href: closest instanceof HTMLAnchorElement ? closest.href : undefined,
        tag: closest.tagName,
      }, true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
    else pushEvent("tab_visible");
  });

  window.addEventListener("pagehide", () => flush(true));
  setInterval(() => flush(), 15_000);
  setTimeout(() => trackSections(), 500);
}

/** Link visitor session to a lead */
export function linkVisitorToLead(leadId: string) {
  if (!sessionId) return;
  fetch("/api/funnel/ad-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, leadId, events: [], duration: 0, maxScroll: 0, interactions: 0, sectionsViewed: [] }),
    keepalive: true,
  }).catch(() => {});
}

/** Get current session ID (for linking to restaurant) */
export function getVisitorSessionId(): string | null {
  if (sessionId) return sessionId;
  try {
    const stored = sessionStorage.getItem("visitor_session");
    if (stored) return JSON.parse(stored).sessionId;
  } catch {}
  return null;
}
