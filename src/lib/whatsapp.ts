/**
 * WhatsApp messaging via Twilio.
 * Sends automated messages to restaurant owners alongside email.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+56962183197";

// Template SID for "carta_lista_v2" (approved by Meta)
const CARTA_LISTA_TEMPLATE = "HX73cbf24831adf5448d0e4eef6cb84f41";

// Template SID para inicio de trial Loyalty
// Cuerpo:
//   Hola {{1}} 👋
//
//   Tu prueba gratuita para *{{2}}* ya está activa por 7 días.
//
//   Revisa tu correo con tus credenciales de acceso y entra directo aquí:
//   quierocomer.com/panel/{{3}}
//
//   Bienvenido a la evolución gastronómica
//   — QuieroComer
//
// Variables: {{1}} = primer nombre, {{2}} = nombre restaurante, {{3}} = ID numérico (short link)
export const LOYALTY_TRIAL_WA_TEMPLATE = process.env.LOYALTY_TRIAL_WA_TEMPLATE_SID || "HXd6ab85f044d19c4524d7cda06dbf2eaf";

// Template SID for billing expiry — day plan expires (aprobado por Meta)
// Variables: {{1}} = owner first name, {{2}} = restaurant name, {{3}} = renewal URL
// Template body:
//   Hola {{1}} 👋
//
//   El plan de *{{2}}* venció hoy. Tu carta QR dejará de mostrarse a partir de mañana.
//
//   Renueva ahora para que tus clientes sigan viendo tu carta:
//   {{3}}
//
//   — Equipo QuieroComer
export const BILLING_EXPIRY_TODAY_WA_TEMPLATE = "HX43db1bcacc9506f6f37f09258e549d27"; // billing_expiry_today_v2 — aprobado

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

    // Twilio acepta el mensaje pero puede fallar despues (template no aprobado, etc.)
    // Status "failed" o "undelivered" significa que no se envio realmente
    if (data.status === "failed" || data.status === "undelivered") {
      console.warn(`[WhatsApp] Message not delivered to ${to}: status=${data.status}, error=${data.error_code}`);
      return null;
    }

    console.log(`[WhatsApp] Message queued to ${to}: SID ${data.sid}, status=${data.status}`);
    import("@/lib/costTracker").then(m => m.logTwilioUsage({ twilioSid: data.sid, to })).catch(() => {});
    return data.sid;
  } catch (err) {
    console.error("[WhatsApp] Send failed:", (err as Error).message);
    return null;
  }
}

/**
 * Build the "loyalty trial started" WhatsApp message for a restaurant owner.
 */
export function buildLoyaltyTrialMessage({
  ownerName,
  restaurantName,
  email,
}: {
  ownerName: string;
  restaurantName: string;
  email: string;
}): { body: string; contentSid: string; contentVariables: Record<string, string> } {
  const firstName = ownerName.split(" ")[0];
  return {
    body: `Hola ${firstName}, tu carta digital de *${restaurantName}* ya está lista en QuieroComer.\n\nEntra a configurarla en quierocomer.com/panel\n\nTe enviamos los detalles a ${email}.\n\n— QuieroComer.com`,
    contentSid: LOYALTY_TRIAL_WA_TEMPLATE,
    contentVariables: { "1": firstName, "2": restaurantName, "3": email },
  };
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
    body: `Hola ${ownerName} 👋\n\nTu carta de *${restaurantName}* está lista.\n\nPuedes verla aquí: ${trackUrl}\n\nCualquier cosa no dudes en contactarnos.\n\n✨ QuieroComer.cl`,
    contentSid: CARTA_LISTA_TEMPLATE,
    contentVariables: { "1": ownerName, "2": restaurantName, "3": trackUrl },
  };
}
