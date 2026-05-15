import { NextResponse } from "next/server";
export const maxDuration = 30;
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/normalizePhone";

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

    const existing = await prisma.lead.findUnique({
      where: { id },
      include: { detectedProvider: { select: { name: true } } },
    });
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

    return NextResponse.json({ id: lead.id });
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
      select: { id: true, cartaUrl: true, cartaFileUrl: true, cartaType: true, cartaStatus: true, email: true, step2At: true, preview: true, localName: true, generatedSlug: true },
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
