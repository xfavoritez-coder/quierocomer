// Cliente de la API oficial de WhatsApp (Cloud API de Meta / Graph API).
// SERVER-ONLY. El token va por local (ecommerceConfig.whatsapp.accessToken, en
// claro acá — se descifra antes de llamar). Ver WHATSAPP_CRM_PLAN.md.
import type { WhatsAppCreds } from "@/lib/ecommerce/config";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface SendResult {
  ok: boolean;
  waMessageId?: string;
  error?: string;
}

function graphUrl(path: string): string {
  return `${GRAPH_BASE}/${path}`;
}

/** Normaliza un teléfono a los dígitos que espera la API (E.164 sin el "+"). */
export function toWaRecipient(phone: string): string {
  return String(phone).replace(/[^\d]/g, "");
}

async function postMessage(creds: WhatsAppCreds, payload: Record<string, unknown>): Promise<SendResult> {
  if (!creds.phoneNumberId || !creds.accessToken) {
    return { ok: false, error: "WhatsApp no configurado (falta phoneNumberId o accessToken)" };
  }
  try {
    const res = await fetch(graphUrl(`${creds.phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data?.error?.message as string) || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    const waMessageId = data?.messages?.[0]?.id as string | undefined;
    return { ok: true, waMessageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/** Envía un mensaje de texto libre (solo válido dentro de la ventana de 24h). */
export function sendText(creds: WhatsAppCreds, toPhone: string, text: string, previewUrl = false): Promise<SendResult> {
  return postMessage(creds, {
    to: toWaRecipient(toPhone),
    type: "text",
    text: { body: text, preview_url: previewUrl },
  });
}

/** Envía una plantilla aprobada (para reabrir fuera de la ventana de 24h). */
export function sendTemplate(
  creds: WhatsAppCreds,
  toPhone: string,
  templateName: string,
  languageCode = "es",
  components?: unknown[],
): Promise<SendResult> {
  return postMessage(creds, {
    to: toWaRecipient(toPhone),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

/** Marca un mensaje entrante como leído (indicador de lectura para el cliente). */
export function markRead(creds: WhatsAppCreds, waMessageId: string): Promise<SendResult> {
  return postMessage(creds, { status: "read", message_id: waMessageId });
}

/** Resuelve la URL temporal de descarga de un media y baja sus bytes.
 *  Se usará en Fase 2 para guardar los medios en Supabase Storage. */
export async function downloadMedia(creds: WhatsAppCreds, mediaId: string): Promise<{ ok: boolean; buffer?: Buffer; mime?: string; error?: string }> {
  if (!creds.accessToken) return { ok: false, error: "Sin accessToken" };
  try {
    const metaRes = await fetch(graphUrl(mediaId), { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    const meta = await metaRes.json().catch(() => ({}));
    const url = meta?.url as string | undefined;
    if (!url) return { ok: false, error: "Sin URL de media" };
    const binRes = await fetch(url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    if (!binRes.ok) return { ok: false, error: `HTTP ${binRes.status}` };
    const buffer = Buffer.from(await binRes.arrayBuffer());
    return { ok: true, buffer, mime: meta?.mime_type as string | undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}
