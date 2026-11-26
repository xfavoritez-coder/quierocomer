import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, addLeadEvent } from "@/lib/ventas/leads";

export const runtime = "nodejs";

const ALLOWED = new Set(["demo_started", "chapter_viewed", "waiter_called", "loyalty_enrolled", "test_order"]);
const CHAPTERS = new Set(["inicio", "carta", "loyalty", "ecommerce", "pos", "planes"]);

/** POST /api/ventas/leads/[id]/events  Body: { type, chapter?, durationMs? } — tracking de la demo del vendedor. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const type = String(b?.type || "");
  if (!ALLOWED.has(type)) return NextResponse.json({ error: "Evento no válido" }, { status: 400 });
  const chapter = CHAPTERS.has(String(b?.chapter)) ? String(b.chapter) : undefined;
  const durationMs = Number.isFinite(Number(b?.durationMs)) ? Math.max(0, Math.min(Math.round(Number(b.durationMs)), 3_600_000)) : undefined;
  if (type === "chapter_viewed" && (!chapter || (durationMs ?? 0) < 1500)) return NextResponse.json({ ok: true, skipped: true }); // vistas muy cortas no cuentan

  const actor = type === "waiter_called" || type === "loyalty_enrolled" || type === "test_order" ? "owner" : "seller"; // lo hizo el dueño desde su celular
  const payload = b?.payload && typeof b.payload === "object" ? { label: String((b.payload as Record<string, unknown>).label ?? "").slice(0, 80) } : undefined;
  await addLeadEvent(id, type, actor, seller.id, { chapter, durationMs, payload });

  // "Demo hecha": se presentó al menos un capítulo de producto.
  if (type === "chapter_viewed" && chapter !== "inicio" && lead.crmStatus === "nuevo") {
    await prisma.lead.update({ where: { id }, data: { crmStatus: "demo_hecha", crmStatusHistory: { push: { status: "demo_hecha", ts: new Date().toISOString() } } } });
    await addLeadEvent(id, "status_changed", "system", seller.id, { payload: { from: "nuevo", to: "demo_hecha" } });
  }
  return NextResponse.json({ ok: true });
}
