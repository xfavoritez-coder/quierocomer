import { NextResponse } from "next/server";
import { processLead } from "@/lib/extractors/pipeline";
export const maxDuration = 300;

/**
 * POST /api/subircarta/process
 * Triggers async processing of a lead.
 * Called after the lead is completed (has email).
 * Body: { leadId: string }
 */
export async function POST(req: Request) {
  try {
    const { leadId } = await req.json();

    if (!leadId) {
      return NextResponse.json({ error: "leadId requerido." }, { status: 400 });
    }

    const result = await processLead(leadId);

    return NextResponse.json({
      ok: true,
      slug: result.slug,
      url: result.url,
    });
  } catch (error: any) {
    console.error("[SubirCarta Process]", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la carta." },
      { status: 500 },
    );
  }
}
