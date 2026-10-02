// Envío de push NATIVO a la app (Capacitor): APNs (iOS) y FCM HTTP v1 (Android).
// Firma JWT con el `crypto` nativo de Node (sin dependencias externas).
import crypto from "crypto";
import http2 from "http2";

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export interface NativePushPayload { title: string; body: string; url?: string; tag?: string }
export interface NativePushResult { ok: boolean; invalid?: boolean; status?: number; reason?: string }

// ─────────────────────────── APNs (iOS) ───────────────────────────

let apnsJwtCache: { jwt: string; at: number } | null = null;

function apnsPrivateKeyPem(): string | null {
  const b64 = process.env.APNS_AUTH_KEY_B64;
  if (!b64) return null;
  return Buffer.from(b64, "base64").toString("utf8");
}

function apnsJwt(): string | null {
  // El token de APNs vale hasta 1h; lo regeneramos cada ~50 min.
  if (apnsJwtCache && Date.now() - apnsJwtCache.at < 50 * 60 * 1000) return apnsJwtCache.jwt;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem = apnsPrivateKeyPem();
  if (!keyId || !teamId || !pem) return null;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signingInput = `${header}.${claims}`;
  const sig = crypto.createSign("SHA256").update(signingInput).sign({ key: pem, dsaEncoding: "ieee-p1363" });
  const jwt = `${signingInput}.${b64url(sig)}`;
  apnsJwtCache = { jwt, at: Date.now() };
  return jwt;
}

function apnsPostOnce(host: string, token: string, jwt: string, bundleId: string, payload: NativePushPayload): Promise<NativePushResult> {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", () => resolve({ ok: false }));
    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default", "content-available": 1 },
      url: payload.url || "/",
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      client.close();
      if (status === 200) return resolve({ ok: true, status });
      let reason = "";
      try { reason = JSON.parse(data || "{}").reason || ""; } catch { /* noop */ }
      const invalid = status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
      resolve({ ok: false, status, reason, invalid });
    });
    req.on("error", () => { client.close(); resolve({ ok: false }); });
    req.end(body);
  });
}

/** Envía a APNs. Prueba el entorno configurado y, si el token es de otro entorno
 *  (BadDeviceToken), reintenta en el otro. iOS dev = sandbox; TestFlight/App Store = production. */
export async function sendApns(token: string, payload: NativePushPayload): Promise<NativePushResult> {
  const jwt = apnsJwt();
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!jwt || !bundleId) return { ok: false, reason: "apns_not_configured" };
  const PROD = "api.push.apple.com";
  const SANDBOX = "api.sandbox.push.apple.com";
  const primary = process.env.APNS_ENV === "sandbox" ? SANDBOX : PROD;
  const secondary = primary === PROD ? SANDBOX : PROD;
  let r = await apnsPostOnce(primary, token, jwt, bundleId, payload);
  if (!r.ok && r.reason === "BadDeviceToken") r = await apnsPostOnce(secondary, token, jwt, bundleId, payload);
  return r;
}

// ──────────────────── APNs Live Activity (iOS) ────────────────────
// Actualiza/termina la Isla Dinámica aunque la app esté cerrada.
export interface LiveActivityUpdate {
  event: "update" | "end";
  contentState: Record<string, unknown>; // debe calzar con ContentState (Swift)
  alert?: { title: string; body: string };
  dismissalDate?: number; // epoch (s), solo para "end"
}

function apnsLaPostOnce(host: string, token: string, jwt: string, bundleId: string, upd: LiveActivityUpdate): Promise<NativePushResult> {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", () => resolve({ ok: false }));
    const aps: Record<string, unknown> = {
      timestamp: Math.floor(Date.now() / 1000),
      event: upd.event,
      "content-state": upd.contentState,
    };
    if (upd.alert) aps.alert = upd.alert;
    if (upd.event === "end" && upd.dismissalDate) aps["dismissal-date"] = upd.dismissalDate;
    const body = JSON.stringify({ aps });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": `${bundleId}.push-type.liveactivity`,
      "apns-push-type": "liveactivity",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      client.close();
      if (status === 200) return resolve({ ok: true, status });
      let reason = "";
      try { reason = JSON.parse(data || "{}").reason || ""; } catch { /* noop */ }
      const invalid = status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
      resolve({ ok: false, status, reason, invalid });
    });
    req.on("error", () => { client.close(); resolve({ ok: false }); });
    req.end(body);
  });
}

export async function sendApnsLiveActivity(token: string, upd: LiveActivityUpdate): Promise<NativePushResult> {
  const jwt = apnsJwt();
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!jwt || !bundleId) return { ok: false, reason: "apns_not_configured" };
  const PROD = "api.push.apple.com";
  const SANDBOX = "api.sandbox.push.apple.com";
  const primary = process.env.APNS_ENV === "sandbox" ? SANDBOX : PROD;
  const secondary = primary === PROD ? SANDBOX : PROD;
  let r = await apnsLaPostOnce(primary, token, jwt, bundleId, upd);
  if (!r.ok && r.reason === "BadDeviceToken") r = await apnsLaPostOnce(secondary, token, jwt, bundleId, upd);
  return r;
}

// ─────────────────────────── FCM (Android) ───────────────────────────

let fcmTokenCache: { token: string; exp: number } | null = null;

function fcmServiceAccount(): { client_email: string; private_key: string; project_id: string } | null {
  const b64 = process.env.FCM_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try { return JSON.parse(Buffer.from(b64, "base64").toString("utf8")); } catch { return null; }
}

async function fcmAccessToken(): Promise<string | null> {
  if (fcmTokenCache && Date.now() < fcmTokenCache.exp - 60_000) return fcmTokenCache.token;
  const sa = fcmServiceAccount();
  if (!sa?.client_email || !sa?.private_key) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const sig = crypto.createSign("RSA-SHA256").update(signingInput).sign(sa.private_key);
  const assertion = `${signingInput}.${b64url(sig)}`;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`,
    });
    const j = await res.json();
    if (!res.ok || !j.access_token) return null;
    fcmTokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    return j.access_token;
  } catch { return null; }
}

// Mensaje FCM data-only para la notificación PERSISTENTE de estado (Android).
// Lo procesa OrderMessagingService en la app (no se muestra como push normal).
export interface FcmOrderStatus {
  orderId: string; status: string; statusLabel: string;
  orderNumber: string; storeName: string; step: number; totalSteps: number; url?: string;
}

export async function sendFcmOrderStatus(token: string, p: FcmOrderStatus): Promise<NativePushResult> {
  const projectId = process.env.FCM_PROJECT_ID || fcmServiceAccount()?.project_id;
  const access = await fcmAccessToken();
  if (!projectId || !access) return { ok: false, reason: "fcm_not_configured" };
  const message = {
    message: {
      token,
      android: { priority: "HIGH" },
      data: {
        type: "order_status",
        orderId: p.orderId,
        status: p.status,
        statusLabel: p.statusLabel,
        orderNumber: p.orderNumber,
        storeName: p.storeName,
        step: String(p.step),
        totalSteps: String(p.totalSteps),
        url: p.url || "/",
      },
    },
  };
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (res.ok) return { ok: true, status: 200 };
    let reason = "";
    try { const j = await res.json(); reason = j?.error?.status || j?.error?.message || ""; } catch { /* noop */ }
    const invalid = res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(reason);
    return { ok: false, status: res.status, reason, invalid };
  } catch { return { ok: false }; }
}

export async function sendFcm(token: string, payload: NativePushPayload): Promise<NativePushResult> {
  const projectId = process.env.FCM_PROJECT_ID || fcmServiceAccount()?.project_id;
  const access = await fcmAccessToken();
  if (!projectId || !access) return { ok: false, reason: "fcm_not_configured" };
  const message = {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url || "/" },
      android: { priority: "HIGH", notification: { tag: payload.tag || "order-status" } },
    },
  };
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (res.ok) return { ok: true, status: 200 };
    let reason = "";
    try { const j = await res.json(); reason = j?.error?.status || j?.error?.message || ""; } catch { /* noop */ }
    const invalid = res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(reason);
    return { ok: false, status: res.status, reason, invalid };
  } catch { return { ok: false }; }
}
