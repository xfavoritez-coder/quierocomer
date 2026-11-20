// POST /api/whatsapp/send  { restaurantId, conversationId, text }
// Envía un mensaje de texto del cajero al cliente (dentro de la ventana de 24h).
// Auth: cookie panel_id (dueño o miembro del equipo con acceso al local).
// Ver WHATSAPP_CRM_PLAN.md.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { sendText } from "@/lib/whatsapp/client";
import { recordOutbound } from "@/lib/whatsapp/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<{ ok: boolean; memberId?: string }> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return { ok: false };
  if (panelId === "demo") return { ok: true };
  if (panelId.startsWith("tm_")) {
    const memberId = panelId.slice(3);
    return { ok: await teamMemberCanAccess(memberId, restaurantId), memberId };
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return { ok: r?.ownerId === panelId };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const conversationId = (body?.conversationId || "").toString();
  const text = (body?.text || "").toString().trim();
  if (!restaurantId || !conversationId || !text) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const auth = await assertOwnership(req, restaurantId);
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const conv = await prisma.waInboxConversation.findFirst({
    where: { id: conversationId, restaurantId },
    select: { id: true, windowExpiresAt: true, contact: { select: { phone: true } } },
  });
  if (!conv?.contact?.phone) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

  // Ventana de 24h: fuera de ella solo se puede enviar plantilla aprobada.
  if (!conv.windowExpiresAt || conv.windowExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Ventana de 24h cerrada: usa una plantilla aprobada", windowClosed: true }, { status: 409 });
  }

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } });
  const creds = decryptEcommerceSecrets(parseEcommerceConfig(r?.ecommerceConfig)).whatsapp;
  if (!creds?.enabled || !creds.phoneNumberId || !creds.accessToken) {
    return NextResponse.json({ error: "WhatsApp no configurado en este local" }, { status: 400 });
  }

  const sent = await sendText(creds, conv.contact.phone, text);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error || "No se pudo enviar" }, { status: 502 });
  }

  const messageId = await recordOutbound({
    restaurantId,
    conversationId,
    waMessageId: sent.waMessageId ?? null,
    type: "text",
    body: text,
    status: "sent",
    sentById: auth.memberId ?? null,
  });

  // El cajero está atendiendo → marcar la conversación como leída.
  await prisma.waInboxConversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } }).catch(() => {});

  return NextResponse.json({ ok: true, messageId, waMessageId: sent.waMessageId });
}
