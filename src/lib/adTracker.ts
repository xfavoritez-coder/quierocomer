/**
 * Ad session tracker — captures UTM params and detailed page behavior
 * for visitors coming from paid ads (Facebook, Google, etc.)
 *
 * Usage: call initAdTracker() on page mount. It checks for utm_source
 * in the URL; if absent it does nothing (zero overhead for organic).
 */

let sessionId: string | null = null;
let events: { ts: number; type: string; data?: any }[] = [];
let startTime = 0;
let maxScroll = 0;
let interactions = 0;
let sectionsViewed = new Set<string>();
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const fbclid = params.get("fbclid");
  const gclid = params.get("gclid");

  // Accept: explicit utm_source OR Facebook fbclid OR Google gclid
  if (!utmSource && !fbclid && !gclid) return null;

  return {
    utmSource: utmSource || (fbclid ? "facebook" : gclid ? "google" : null),
    utmMedium: params.get("utm_medium") || (fbclid ? "paid" : gclid ? "cpc" : null),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    fbclid,
  };
}

function genSessionId() {
  return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pushEvent(type: string, data?: any) {
  events.push({ ts: Date.now() - startTime, type, data });
  interactions++;
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {}).finally(() => { flushing = false; });
  }
}

function trackScroll() {
  const scrollPct = Math.round(
    (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
  );
  if (scrollPct > maxScroll) {
    const prev = maxScroll;
    maxScroll = scrollPct;
    // Log milestones
    for (const milestone of [25, 50, 75, 100]) {
      if (prev < milestone && maxScroll >= milestone) {
        pushEvent("scroll_milestone", { pct: milestone });
      }
    }
  }
}

function trackSections() {
  const sections = document.querySelectorAll("section[aria-label], section[data-section], [data-track]");
  sections.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const name = el.getAttribute("aria-label") || el.getAttribute("data-section") || el.getAttribute("data-track") || "unknown";
      if (!sectionsViewed.has(name)) {
        sectionsViewed.add(name);
        pushEvent("section_view", { section: name });
      }
    }
  });
}

export function initAdTracker() {
  if (initialized || typeof window === "undefined") return;

  const utms = getUtmParams();
  if (!utms) return; // Not an ad visitor, do nothing

  initialized = true;
  sessionId = genSessionId();
  startTime = Date.now();

  // Store UTMs in sessionStorage for cross-page tracking within this session
  sessionStorage.setItem("ad_session", JSON.stringify({ sessionId, ...utms }));

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

  pushEvent("page_load", { page: window.location.pathname });

  // Scroll tracking
  let scrollRAF: number | null = null;
  window.addEventListener("scroll", () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      trackScroll();
      trackSections();
      scrollRAF = null;
    });
  }, { passive: true });

  // Click tracking
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const closest = target.closest("a, button, [role='button'], .method, .upload-card, .cta");
    if (closest) {
      const label = closest.textContent?.trim().slice(0, 60) ||
        closest.getAttribute("aria-label") ||
        closest.tagName;
      const href = closest instanceof HTMLAnchorElement ? closest.href : undefined;
      pushEvent("click", { label, href, tag: closest.tagName });
    }
  });

  // Input focus tracking
  document.addEventListener("focusin", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      pushEvent("input_focus", {
        type: (target as HTMLInputElement).type,
        placeholder: (target as HTMLInputElement).placeholder?.slice(0, 40),
      });
    }
  });

  // Visibility change (tab switch)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      pushEvent("tab_hidden");
      flush(true);
    } else {
      pushEvent("tab_visible");
    }
  });

  // Before unload
  window.addEventListener("pagehide", () => flush(true));

  // Periodic flush every 15s
  flushTimer = setInterval(() => flush(), 15_000);

  // Initial section check
  setTimeout(() => trackSections(), 500);
}

/** Resume tracking on subsequent pages (paso2, confirmacion) */
export function resumeAdTracker() {
  if (initialized || typeof window === "undefined") return;

  const stored = sessionStorage.getItem("ad_session");
  if (!stored) return;

  try {
    const data = JSON.parse(stored);
    sessionId = data.sessionId;
  } catch { return; }

  if (!sessionId) return;

  initialized = true;
  startTime = Date.now();

  pushEvent("page_load", { page: window.location.pathname });

  // Same listeners as init
  let scrollRAF: number | null = null;
  window.addEventListener("scroll", () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => { trackScroll(); trackSections(); scrollRAF = null; });
  }, { passive: true });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const closest = target.closest("a, button, [role='button'], .method, .upload-card, .cta");
    if (closest) {
      pushEvent("click", { label: closest.textContent?.trim().slice(0, 60), tag: closest.tagName });
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });

  window.addEventListener("pagehide", () => flush(true));
  flushTimer = setInterval(() => flush(), 15_000);
  setTimeout(() => trackSections(), 500);
}

/** Link ad session to a lead when they create one */
export function linkAdSessionToLead(leadId: string) {
  if (!sessionId) return;
  fetch("/api/funnel/ad-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, leadId, events: [], duration: 0, maxScroll: 0, interactions: 0, sectionsViewed: [] }),
    keepalive: true,
  }).catch(() => {});
}
