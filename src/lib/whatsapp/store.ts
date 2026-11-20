// Persistencia de la bandeja de WhatsApp: upsert de contacto/conversación y
// alta de mensajes (entrantes y salientes), idempotente por waMessageId.
// SERVER-ONLY. Ver WHATSAPP_CRM_PLAN.md.
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 24 * 60 * 60 * 1000; // ventana de servicio de 24h

export interface InboundMessage {
  waMessageId: string;
  from: string;        // teléfono del cliente (dígitos)
  profileName?: string | null;
  type: string;        // text|image|audio|document|...
  body?: string | null;
  mediaId?: string | null;
  timestamp?: number | null; // epoch segundos
}

/** Normaliza un teléfono entrante a E.164 (+<dígitos>). */
function toE164(digits: string): string {
  const d = String(digits).replace(/[^\d]/g, "");
  return d.startsWith("+") ? d : `+${d}`;
}

/** Procesa un mensaje entrante: upsert contacto + conversación (reinicia ventana
 *  de 24h) + alta del mensaje. Idempotente: si el waMessageId ya existe, no
 *  duplica. Devuelve ids para poder emitir realtime / debug. */
export async function ingestInbound(restaurantId: string, m: InboundMessage): Promise<{ conversationId: string; contactId: string; messageId: string | null; duplicate: boolean }> {
  const phone = toE164(m.from);

  // Idempotencia: Meta reenvía webhooks. Si ya tenemos este waMessageId, salimos.
  if (m.waMessageId) {
    const existing = await prisma.waInboxMessage.findUnique({ where: { waMessageId: m.waMessageId }, select: { id: true, conversationId: true } });
    if (existing) {
      const conv = await prisma.waInboxConversation.findUnique({ where: { id: existing.conversationId }, select: { contactId: true } });
      return { conversationId: existing.conversationId, contactId: conv?.contactId ?? "", messageId: existing.id, duplicate: true };
    }
  }

  // Contacto (único por restaurante+teléfono).
  const contact = await prisma.waInboxContact.upsert({
    where: { restaurantId_phone: { restaurantId, phone } },
    update: { waId: m.from, ...(m.profileName ? { name: m.profileName } : {}) },
    create: { restaurantId, phone, waId: m.from, name: m.profileName ?? null },
    select: { id: true },
  });

  // Conversación abierta más reciente, o se crea una.
  let conversation = await prisma.waInboxConversation.findFirst({
    where: { restaurantId, contactId: contact.id, status: "open" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!conversation) {
    conversation = await prisma.waInboxConversation.create({
      data: { restaurantId, contactId: contact.id, status: "open" },
      select: { id: true },
    });
  }

  const at = m.timestamp ? new Date(m.timestamp * 1000) : new Date();

  const message = await prisma.waInboxMessage.create({
    data: {
      conversationId: conversation.id,
      restaurantId,
      direction: "in",
      type: m.type || "text",
      body: m.body ?? null,
      mediaId: m.mediaId ?? null,
      waMessageId: m.waMessageId || null,
      createdAt: at,
    },
    select: { id: true },
  });

  // Reinicia la ventana de 24h y marca no leído.
  await prisma.waInboxConversation.update({
    where: { id: conversation.id },
    data: {
      status: "open",
      lastInboundAt: at,
      lastMessageAt: at,
      windowExpiresAt: new Date(at.getTime() + WINDOW_MS),
      unreadCount: { increment: 1 },
    },
  });

  return { conversationId: conversation.id, contactId: contact.id, messageId: message.id, duplicate: false };
}

/** Registra un mensaje saliente (ya enviado a la API). Actualiza lastMessageAt. */
export async function recordOutbound(params: {
  restaurantId: string;
  conversationId: string;
  waMessageId?: string | null;
  type?: string;
  body?: string | null;
  mediaUrl?: string | null;
  status?: string | null;
  sentById?: string | null;
  posOrderId?: string | null;
}): Promise<string> {
  const now = new Date();
  const msg = await prisma.waInboxMessage.create({
    data: {
      conversationId: params.conversationId,
      restaurantId: params.restaurantId,
      direction: "out",
      type: params.type || "text",
      body: params.body ?? null,
      mediaUrl: params.mediaUrl ?? null,
      waMessageId: params.waMessageId ?? null,
      status: params.status ?? "sent",
      sentById: params.sentById ?? null,
      posOrderId: params.posOrderId ?? null,
      createdAt: now,
    },
    select: { id: true },
  });
  await prisma.waInboxConversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: now, status: "open" },
  });
  return msg.id;
}

/** Actualiza el estado de un mensaje saliente por su waMessageId (delivered/read/failed). */
export async function updateMessageStatus(waMessageId: string, status: string, errorDetail?: string | null): Promise<void> {
  if (!waMessageId) return;
  await prisma.waInboxMessage.updateMany({
    where: { waMessageId },
    data: { status, ...(errorDetail ? { errorDetail } : {}) },
  });
}
