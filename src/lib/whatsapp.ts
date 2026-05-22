/**
 * WhatsApp messaging via Twilio.
 * Sends automated messages to restaurant owners alongside email.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

// Template SID for "carta_lista" (approved by Meta)
const CARTA_LISTA_TEMPLATE = "HX1baecda12637c194435ec3cbb8e30d35";

interface SendWhatsAppOptions {
  to: string; // E.164 format: +56912345678
  body: string;
  contentSid?: string; // Template SID for business-initiated messages
  contentVariables?: Record<string, string>;
}

/**
 * Send a WhatsApp message via Twilio API.
 * Uses content templates for business-initiated messages.
 * Falls back to free-form body if within 24h conversation window.
 * Returns the message SID on success, null on failure.
 */
export async function sendWhatsApp({ to, body, contentSid, contentVariables }: SendWhatsAppOptions): Promise<string | null> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.warn("[WhatsApp] Twilio credentials not configured, skipping");
    return null;
  }

  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const params: Record<string, string> = {
    From: TWILIO_FROM,
    To: toNumber,
  };

  // Use template if provided (required for business-initiated messages)
  if (contentSid) {
    params.ContentSid = contentSid;
    if (contentVariables) params.ContentVariables = JSON.stringify(contentVariables);
  } else {
    params.Body = body;
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      // If template fails, try free-form as fallback
      if (contentSid && body) {
        console.warn("[WhatsApp] Template failed, trying free-form:", data.message);
        return sendWhatsApp({ to, body });
      }
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
 * Returns both the template config and a free-form fallback.
 */
export function buildCartaReadyMessage({
  ownerName,
  restaurantName,
  trackUrl,
}: {
  ownerName: string;
  restaurantName: string;
  trackUrl: string;
}): { body: string; contentSid: string; contentVariables: Record<string, string> } {
  return {
    body: `Hola ${ownerName} 👋\n\nTu carta de *${restaurantName}* está lista.\n\nMírala aquí: ${trackUrl}\n\nIncluye todas las funcionalidades Premium por 14 días gratis.\n\nSi tienes alguna duda, responde este mensaje.\n\n— QuieroComer`,
    contentSid: CARTA_LISTA_TEMPLATE,
    contentVariables: { "1": ownerName, "2": restaurantName, "3": trackUrl },
  };
}
