import http2 from "http2";
import { prisma } from "@/lib/prisma";

/**
 * Envío de notificaciones push a Apple Wallet (APNs) — módulo liviano (solo http2),
 * para no arrastrar @napi-rs/canvas a las rutas de sellos.
 */

function apnsConfig() {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const certB64 = process.env.APPLE_PASS_CERT_BASE64;
  const keyB64 = process.env.APPLE_PASS_KEY_BASE64;
  if (!passTypeId || !certB64 || !keyB64) return null;
  return {
    passTypeId,
    cert: Buffer.from(certB64, "base64").toString("utf8"),
    key: Buffer.from(keyB64, "base64").toString("utf8"),
  };
}

type PushType = "background" | "alert";

async function pushToTokens(tokens: string[], pushType: PushType = "background", payload?: object): Promise<void> {
  const cfg = apnsConfig();
  if (!cfg || tokens.length === 0) return;

  const body = pushType === "alert" && payload
    ? JSON.stringify(payload)
    : JSON.stringify({});

  await new Promise<void>((resolve) => {
    let client: http2.ClientHttp2Session;
    try {
      client = http2.connect("https://api.push.apple.com:443", { cert: cfg.cert, key: cfg.key });
    } catch {
      return resolve();
    }
    client.on("error", () => resolve());

    let pending = tokens.length;
    const done = () => {
      if (--pending <= 0) {
        client.close();
        resolve();
      }
    };

    for (const token of tokens) {
      const headers: Record<string, string | number> = {
        ":method": "POST",
        ":path": `/3/device/${token}`,
        "apns-topic": cfg.passTypeId,
        "apns-push-type": pushType,
        "apns-priority": pushType === "alert" ? "10" : "5",
      };
      const reqStream = client.request(headers);
      let status = 0;
      let responseBody = "";
      reqStream.on("response", (h) => { status = h[":status"] as number; });
      reqStream.on("data", (chunk) => { responseBody += chunk.toString(); });
      reqStream.on("end", () => {
        if (status && status !== 200 && status !== 201) {
          console.error(`[APNs] token ${token.slice(0, 8)}… status=${status} body=${responseBody}`);
        }
        done();
      });
      reqStream.on("error", (e) => { console.error("[APNs] stream error:", e); done(); });
      reqStream.end(body);
    }
  });
}

/** Notifica a los dispositivos iOS registrados del miembro para que refresquen el pase. Best-effort. */
export async function notifyAppleDevices(memberId: string): Promise<void> {
  if (!apnsConfig()) return;
  try {
    const devices = await prisma.loyaltyDevice.findMany({
      where: { serialNumber: memberId },
      select: { pushToken: true },
    });
    if (devices.length) await pushToTokens(devices.map((d) => d.pushToken), "background");
  } catch (e) {
    console.error("[notifyAppleDevices]", e);
  }
}

/** Notifica a TODOS los dispositivos iOS de los miembros del restaurante con una alerta visible. Devuelve cuántos. */
export async function notifyRestaurantDevices(restaurantId: string, title?: string, message?: string): Promise<number> {
  if (!apnsConfig()) return 0;
  try {
    const members = await prisma.loyaltyMember.findMany({ where: { restaurantId }, select: { id: true } });
    if (!members.length) return 0;
    const devices = await prisma.loyaltyDevice.findMany({
      where: { serialNumber: { in: members.map((m) => m.id) } },
      select: { pushToken: true },
    });
    if (!devices.length) return 0;

    if (title || message) {
      // Push con alerta visible: aparece como banner (se auto-descarta) en lugar de notificación persistente de PassKit
      const payload = {
        aps: {
          alert: { title: title || "", body: message || "" },
          sound: "default",
        },
      };
      await pushToTokens(devices.map((d) => d.pushToken), "alert", payload);
    } else {
      // Sin mensaje: push silencioso para refrescar el pase
      await pushToTokens(devices.map((d) => d.pushToken), "background");
    }
    return devices.length;
  } catch (e) {
    console.error("[notifyRestaurantDevices]", e);
    return 0;
  }
}
