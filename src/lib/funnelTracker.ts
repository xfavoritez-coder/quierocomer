/** Track funnel events for /subircarta leads */
export function trackFunnelEvent(leadId: string | null, action: string, metadata?: Record<string, any>) {
  if (!leadId) return;
  fetch("/api/subircarta/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId, action, ...metadata }),
    keepalive: true,
  }).catch(() => {});
}

/** Track funnel events by restaurant slug (for carta/panel where leadId isn't known) */
export function trackFunnelEventBySlug(slug: string | null, action: string, metadata?: Record<string, any>) {
  if (!slug) return;
  fetch("/api/subircarta/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, action, ...metadata }),
    keepalive: true,
  }).catch(() => {});
}

/** Send beacon (works on page close/unload) */
export function beaconFunnelEvent(slug: string | null, action: string, metadata?: Record<string, any>) {
  if (!slug || typeof navigator === "undefined") return;
  const data = JSON.stringify({ slug, action, ...metadata });
  navigator.sendBeacon("/api/subircarta/event", new Blob([data], { type: "application/json" }));
}
