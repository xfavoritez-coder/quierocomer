import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/normalizePhone";
import { generatePreview } from "@/lib/extractors/preview";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { localName, ownerName, email, whatsapp } = body;

    if (!localName || !ownerName || !email) {
      return NextResponse.json(
        { error: "Nombre del local, tu nombre y correo son obligatorios." },
        { status: 400 },
      );
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead no encontrado." }, { status: 404 });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        localName,
        ownerName,
        email,
        whatsapp: normalizePhone(whatsapp),
        completedAt: existing.completedAt || new Date(),
      },
    });

    // Step 1 (sync): fast preview extraction — logo + first 5 dishes (~3s)
    let preview = null;
    if (lead.cartaUrl && lead.cartaStatus === "PENDING") {
      try {
        preview = await generatePreview(lead.id);
      } catch (e) {
        console.error("[SubirCarta Preview]", e);
      }

      // Step 2 (async): full processing — all dishes, photos, restaurant creation
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
      fetch(`${baseUrl}/api/subircarta/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      }).catch(() => {});
    }

    return NextResponse.json({ id: lead.id, preview });
  } catch (error) {
    console.error("[SubirCarta PATCH]", error);
    return NextResponse.json(
      { error: "Error al guardar los datos." },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, cartaUrl: true, cartaFileUrl: true, cartaType: true, cartaStatus: true, email: true, step2At: true, preview: true, localName: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead no encontrado." }, { status: 404 });
    }

    // Mark step2At on first visit (fire-and-forget)
    if (!lead.step2At) {
      prisma.lead.update({ where: { id }, data: { step2At: new Date() } }).catch(() => {});
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("[SubirCarta GET]", error);
    return NextResponse.json(
      { error: "Error al obtener el lead." },
      { status: 500 },
    );
  }
}
