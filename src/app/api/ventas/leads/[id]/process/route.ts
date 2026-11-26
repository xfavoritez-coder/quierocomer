import { NextRequest, NextResponse } from "next/server";
import { processLead } from "@/lib/extractors/pipeline";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, addLeadEvent } from "@/lib/ventas/leads";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/ventas/leads/[id]/process — corre el motor de extracción (el mismo de /subircarta). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (lead.captureSource === "none") return NextResponse.json({ ok: true, skipped: true });
  // Locales capturados antes con el nombre provisorio: que el motor use el nombre de la carta.
  if (lead.localName === "Local sin nombre") { await prisma.lead.update({ where: { id }, data: { localName: "" } }); lead.localName = ""; }
  try {
    const r = await processLead(id);
    if (!lead.localName?.trim() && r.slug) {
      const rest = await prisma.restaurant.findUnique({ where: { slug: r.slug }, select: { name: true } });
      if (rest?.name) await prisma.lead.update({ where: { id }, data: { localName: rest.name } });
    }
    await addLeadEvent(id, "menu_extracted", "system", seller.id, { payload: { slug: r.slug } });
    return NextResponse.json({ ok: true, slug: r.slug });
  } catch (e) {
    const msg = (e as Error).message || "Error";
    await addLeadEvent(id, "menu_failed", "system", seller.id, { payload: { error: msg.slice(0, 300) } });
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
