import { NextRequest, NextResponse } from "next/server";
import { generatePreview } from "@/lib/extractors/preview";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead } from "@/lib/ventas/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/ventas/leads/[id]/preview — vista previa rápida (nombre, logo y algunos platos), la misma
 *  de /subircarta, mientras el motor arma la carta completa. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (lead.captureSource === "none" || lead.preview) return NextResponse.json({ ok: true, skipped: true });
  try {
    const preview = await generatePreview(id);
    return NextResponse.json({ ok: true, preview });
  } catch (e) {
    console.error("[ventas preview]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 200 });
  }
}
