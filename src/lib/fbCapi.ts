/**
 * Facebook Conversions API (CAPI) — server-side event tracking
 * Pixel ID: 1532906358481871
 * Deduplicates with browser pixel via event_id
 */
import crypto from "crypto";

const PIXEL_ID = "1532906358481871";
const API_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );
}

interface CapiEventOptions {
  eventName: string;
  eventId?: string;
  sourceUrl: string;
  email?: string;
  phone?: string;
  /** value in CLP */
  value?: number;
  contentName?: string;
  /** Raw Cookie header from the incoming request */
  cookieHeader?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

export async function sendCapiEvent(opts: CapiEventOptions): Promise<void> {
  const token = process.env.FB_CAPI_TOKEN;
  if (!token) return;

  const cookies = parseCookies(opts.cookieHeader ?? null);
  const fbp = cookies["_fbp"] ?? undefined;
  const fbc = cookies["_fbc"] ?? undefined;

  const userData: Record<string, unknown> = {};
  if (opts.email) userData.em = [sha256(opts.email)];
  if (opts.phone) userData.ph = [sha256(opts.phone.replace(/\D/g, ""))];
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;

  const event: Record<string, unknown> = {
    event_name: opts.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_source_url: opts.sourceUrl,
    user_data: userData,
  };
  if (opts.eventId) event.event_id = opts.eventId;
  if (opts.value || opts.contentName) {
    event.custom_data = {
      currency: "CLP",
      value: opts.value ?? 49900,
      ...(opts.contentName ? { content_name: opts.contentName } : {}),
    };
  }

  try {
    const res = await fetch(`${API_URL}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event] }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[CAPI] Error:", res.status, txt);
    }
  } catch (e) {
    console.error("[CAPI] fetch error:", e);
  }
}

/** Paso 2 completado — registra CompleteRegistration + Purchase */
export async function capiPaso2Completed(opts: {
  email: string;
  phone?: string;
  leadId: string;
  cookieHeader?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}) {
  const base = {
    email: opts.email,
    phone: opts.phone,
    sourceUrl: "https://quierocomer.com/subircarta/paso2",
    value: 49900,
    contentName: "Subir Carta Completo",
    cookieHeader: opts.cookieHeader,
    clientIp: opts.clientIp,
    userAgent: opts.userAgent,
  };
  await Promise.all([
    sendCapiEvent({ ...base, eventName: "CompleteRegistration", eventId: `paso2_reg_${opts.leadId}` }),
    sendCapiEvent({ ...base, eventName: "Purchase", eventId: `paso2_pur_${opts.leadId}` }),
  ]);
}

/** Carta lista — registra Lead */
export async function capiCartaReady(opts: {
  email: string;
  phone?: string;
  leadId: string;
  slug?: string;
}) {
  await sendCapiEvent({
    email: opts.email,
    phone: opts.phone,
    eventName: "Lead",
    eventId: `carta_ready_${opts.leadId}`,
    sourceUrl: opts.slug
      ? `https://quierocomer.com/subircarta/confirmacion`
      : "https://quierocomer.com/subircarta/confirmacion",
    value: 49900,
    contentName: "Carta QR Lista",
  });
}
