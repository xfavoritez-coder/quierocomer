import { NextResponse } from "next/server";
import { generatePreview } from "@/lib/extractors/preview";
export const maxDuration = 60;

/**
 * POST /api/subircarta/preview
 * Quick preview generation (~15s for non-Justo, ~3s for Justo).
 * Fires during paso 2 animation so preview is ready at confirmation.
 */
export async function POST(req: Request) {
  let leadId: string | null = null;
  try {
    const body = await req.json();
    leadId = body.leadId;
    if (!leadId) return NextResponse.json({ error: "leadId requerido." }, { status: 400 });

    const preview = await generatePreview(leadId);
    return NextResponse.json({ ok: true, preview });
  } catch (error: any) {
    console.error("[SubirCarta Preview]", error);
    // Notify admin that preview failed
    if (leadId) {
      try {
        const { sendAdminPush } = await import("@/lib/adminPush");
        const { prisma } = await import("@/lib/prisma");
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { localName: true, cartaUrl: true } });
        await sendAdminPush(
          "⚠️ Preview falló",
          `${lead?.localName || lead?.cartaUrl?.slice(0, 30) || "Lead"} necesita atención`,
        );
      } catch {}
    }
    return NextResponse.json({ error: error.message || "Error al generar preview." }, { status: 500 });
  }
}
