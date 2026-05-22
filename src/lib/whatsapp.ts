/**
 * WhatsApp messaging via Twilio.
 * Sends automated messages to restaurant owners alongside email.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

interface SendWhatsAppOptions {
  to: string; // E.164 format: +56912345678
  body: string;
}

/**
 * Send a WhatsApp message via Twilio API.
 * Returns the message SID on success, null on failure.
 */
export async function sendWhatsApp({ to, body }: SendWhatsAppOptions): Promise<string | null> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.warn("[WhatsApp] Twilio credentials not configured, skipping");
    return null;
  }

  // Ensure 'whatsapp:' prefix
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_FROM,
        To: toNumber,
        Body: body,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[WhatsApp] Twilio error:", data.message || data.code);
      return null;
    }

    console.log(`[WhatsApp] Message sent to ${to}: SID ${data.sid}`);
    return data.sid;
  } catch (err) {
    console.error("[WhatsApp] Send failed:", (err as Error).message);
    return null;
  }
}

/**
 * Build the "carta lista" WhatsApp message for a restaurant owner.
 */
export function buildCartaReadyMessage({
  ownerName,
  restaurantName,
  cartaUrl,
  trackUrl,
}: {
  ownerName: string;
  restaurantName: string;
  cartaUrl: string;
  trackUrl: string;
}): string {
  return `Hola ${ownerName} 👋

Tu carta de *${restaurantName}* está lista.

Mírala aquí: ${trackUrl}

Incluye todas las funcionalidades Premium por 14 días gratis.

Si tienes alguna duda, responde este mensaje.

— QuieroComer`;
}
