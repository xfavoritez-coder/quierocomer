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
