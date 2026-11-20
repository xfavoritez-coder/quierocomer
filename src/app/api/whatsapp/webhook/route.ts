// ═══════════════════════════════════════════════════════════
//  Webhook oficial de WhatsApp (Cloud API de Meta).
//  GET  = verificación (hub.verify_token == WHATSAPP_VERIFY_TOKEN).
//  POST = mensajes entrantes + estados (delivered/read/failed).
//  Es GLOBAL: Meta manda todas las WABAs a esta URL; ruteamos por
//  metadata.phone_number_id → restaurante (ecommerceConfig.whatsapp).
//  Ver WHATSAPP_CRM_PLAN.md.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ingestInbound, updateMessageStatus, type InboundMessage } from "@/lib/whatsapp/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET: verificación del webhook ──────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Valida la firma X-Hub-Signature-256 (HMAC-SHA256 del body crudo con el app
// secret). Si no hay WHATSAPP_APP_SECRET configurado, no se valida (dev).
function validSignature(raw: string, header: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // sin secret → no se exige firma (entorno de desarrollo)
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Resuelve el restaurante por el phone_number_id del número (guardado en la config).
async function restaurantFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  try {
    const r = await prisma.restaurant.findFirst({
      where: { ecommerceConfig: { path: ["whatsapp", "phoneNumberId"], equals: phoneNumberId } },
      select: { id: true },
    });
    return r?.id ?? null;
  } catch {
    return null;
  }
}

// Extrae el cuerpo de texto/medios de un mensaje entrante según su tipo.
function parseInbound(msg: Record<string, unknown>, profileName?: string | null): InboundMessage {
  const type = String(msg.type || "text");
  let body: string | null = null;
  let mediaId: string | null = null;
  switch (type) {
    case "text":
      body = (msg.text as { body?: string } | undefined)?.body ?? null;
      break;
    case "button":
      body = (msg.button as { text?: string } | undefined)?.text ?? null;
      break;
    case "interactive": {
      const i = msg.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
      body = i?.button_reply?.title ?? i?.list_reply?.title ?? null;
      break;
    }
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker": {
      const media = msg[type] as { id?: string; caption?: string } | undefined;
      mediaId = media?.id ?? null;
      body = media?.caption ?? null;
      break;
    }
    case "location": {
      const loc = msg.location as { latitude?: number; longitude?: number; name?: string } | undefined;
      body = loc ? `📍 ${loc.name ?? ""} (${loc.latitude},${loc.longitude})`.trim() : null;
      break;
    }
    default:
      body = null;
  }
  const tsRaw = msg.timestamp as string | number | undefined;
  const timestamp = tsRaw != null && Number.isFinite(Number(tsRaw)) ? Number(tsRaw) : null;
  return {
    waMessageId: String(msg.id || ""),
    from: String(msg.from || ""),
    profileName: profileName ?? null,
    type,
    body,
    mediaId,
    timestamp,
  };
}

// ── POST: eventos (mensajes + estados) ─────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Respondemos 200 pase lo que pase (Meta reintenta si no); procesamos best-effort.
  try {
    const entries = Array.isArray(body.entry) ? (body.entry as Record<string, unknown>[]) : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? (entry.changes as Record<string, unknown>[]) : [];
      for (const change of changes) {
        const value = (change.value && typeof change.value === "object" ? change.value : {}) as Record<string, unknown>;
        const metadata = (value.metadata && typeof value.metadata === "object" ? value.metadata : {}) as Record<string, unknown>;
        const phoneNumberId = String(metadata.phone_number_id || "");
        if (!phoneNumberId) continue;
        const restaurantId = await restaurantFromPhoneNumberId(phoneNumberId);
        if (!restaurantId) continue; // número no mapeado a ningún local

        // Nombre de perfil (viene en contacts[], paralelo a messages[]).
        const contacts = Array.isArray(value.contacts) ? (value.contacts as Record<string, unknown>[]) : [];
        const profileNameByWaId = new Map<string, string>();
        for (const c of contacts) {
          const waId = String(c.wa_id || "");
          const name = (c.profile as { name?: string } | undefined)?.name;
          if (waId && name) profileNameByWaId.set(waId, name);
        }

        // Mensajes entrantes.
        const messages = Array.isArray(value.messages) ? (value.messages as Record<string, unknown>[]) : [];
        for (const msg of messages) {
          const from = String(msg.from || "");
          const parsed = parseInbound(msg, profileNameByWaId.get(from));
          if (!parsed.waMessageId || !parsed.from) continue;
          await ingestInbound(restaurantId, parsed).catch(() => {});
        }

        // Estados de mensajes salientes.
        const statuses = Array.isArray(value.statuses) ? (value.statuses as Record<string, unknown>[]) : [];
        for (const st of statuses) {
          const id = String(st.id || "");
          const status = String(st.status || "");
          if (!id || !status) continue;
          const errTitle = (st.errors as { title?: string }[] | undefined)?.[0]?.title ?? null;
          await updateMessageStatus(id, status, errTitle).catch(() => {});
        }
      }
    }
  } catch {
    // nunca romper el webhook: Meta marca fallo y reintenta en bucle
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
