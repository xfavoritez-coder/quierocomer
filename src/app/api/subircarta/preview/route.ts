import { NextResponse } from "next/server";
import { generatePreview } from "@/lib/extractors/preview";
export const maxDuration = 60;

/**
 * POST /api/subircarta/preview
 * Quick preview generation (~15s for non-Justo, ~3s for Justo).
 * Fires during paso 2 animation so preview is ready at confirmation.
 */
export async function POST(req: Request) {
  try {
    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId requerido." }, { status: 400 });

    const preview = await generatePreview(leadId);
    return NextResponse.json({ ok: true, preview });
  } catch (error: any) {
    console.error("[SubirCarta Preview]", error);
    return NextResponse.json({ error: error.message || "Error al generar preview." }, { status: 500 });
  }
}
