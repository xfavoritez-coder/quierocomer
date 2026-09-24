// ═══════════════════════════════════════════════════════════
//  Twilio WhatsApp — aviso al cliente cuando su pedido entra al
//  Centro de pedidos. Usa una plantilla aprobada (Content SID).
// ═══════════════════════════════════════════════════════════
import type { TwilioCreds } from "@/lib/ecommerce/config";

/** Normaliza un teléfono a formato E.164 chileno con prefijo whatsapp:.
 *  Acepta "9XXXXXXXX", "56 9 ...", "+56 9 ...". Devuelve null si no parece válido. */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");
  if (digits.startsWith("whatsapp:")) return digits;
  if (digits.startsWith("+")) return `whatsapp:${digits}`;
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;
  // Chile: 9 dígitos que empiezan en 9 → +569XXXXXXXX
  if (digits.length === 9 && digits.startsWith("9")) return `whatsapp:+56${digits}`;
  if (digits.length === 11 && digits.startsWith("56")) return `whatsapp:+${digits}`;
  if (digits.length >= 11) return `whatsapp:+${digits}`;
  return null;
}

function normalizeFrom(from: string): string {
  const f = from.trim();
  if (f.startsWith("whatsapp:")) return f;
  return `whatsapp:${f.startsWith("+") ? f : `+${f.replace(/\D/g, "")}`}`;
}

/** Nombre de la marca/local visible para el cliente, a partir del vendorName del
 *  pedido. Un mismo Centro de pedidos (una cuenta Toteat) puede recibir pedidos de
 *  varias marcas: el vendorName llega como "QC-<Local>" o "QC-<Local>-Web".
 *  Limpia el prefijo "QC-" y el sufijo "-Web". Si no hay, usa el fallback. */
export function localNameFromVendor(vendorName: string | null | undefined, fallback: string): string {
  const v = (vendorName || "").trim();
  if (!v) return fallback;
  let name = v.replace(/^QC-/i, "").replace(/-Web$/i, "").trim();
  if (!name || /^quierocomer$/i.test(name)) return fallback;
  return name;
}

export interface TwilioSendResult {
  ok: boolean;
  sid: string | null;
  message: string;
}

/** Envía un mensaje de WhatsApp con plantilla (Content SID) vía Twilio. */
export async function sendWhatsappTemplate(
  creds: TwilioCreds,
  to: string,
  contentVariables: Record<string, string>,
): Promise<TwilioSendResult> {
  const accountSid = (creds.accountSid || "").trim();
  const authToken = (creds.authToken || "").trim();
  const contentSid = (creds.contentSid || "").trim();
  if (!accountSid || !authToken || !contentSid) return { ok: false, sid: null, message: "Twilio no configurado (accountSid/authToken/contentSid)" };
  if (!creds.from && !creds.messagingServiceSid) return { ok: false, sid: null, message: "Falta remitente Twilio (from o messagingServiceSid)" };

  const toWa = to.startsWith("whatsapp:") ? to : toWhatsappNumber(to);
  if (!toWa) return { ok: false, sid: null, message: "Teléfono del cliente inválido" };

  const form = new URLSearchParams();
  form.set("To", toWa);
  if (creds.messagingServiceSid?.trim()) form.set("MessagingServiceSid", creds.messagingServiceSid.trim());
  else form.set("From", normalizeFrom(creds.from!));
  form.set("ContentSid", contentSid);
  if (Object.keys(contentVariables).length) form.set("ContentVariables", JSON.stringify(contentVariables));

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, sid: null, message: data?.message || `HTTP ${res.status}` };
    return { ok: true, sid: (data?.sid as string) || null, message: "OK" };
  } catch (err) {
    return { ok: false, sid: null, message: err instanceof Error ? err.message : "Error Twilio" };
  }
}
