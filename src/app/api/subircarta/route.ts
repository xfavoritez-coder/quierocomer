import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cartaType, cartaUrl } = body;

    if (cartaType !== "LINK") {
      return NextResponse.json(
        { error: "Solo el modo LINK está habilitado por ahora." },
        { status: 400 },
      );
    }

    if (!cartaUrl || typeof cartaUrl !== "string") {
      return NextResponse.json(
        { error: "Debes ingresar una URL válida." },
        { status: 400 },
      );
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cartaUrl);
    } catch {
      return NextResponse.json(
        { error: "La URL ingresada no es válida." },
        { status: 400 },
      );
    }

    // Detect provider by matching domain against MenuProvider.domainPatterns
    const hostname = parsedUrl.hostname.toLowerCase();
    const providers = await prisma.menuProvider.findMany({
      select: { id: true, domainPatterns: true },
    });

    let detectedProviderId: string | null = null;
    for (const provider of providers) {
      const match = provider.domainPatterns.some((pattern) =>
        hostname.includes(pattern.toLowerCase()),
      );
      if (match) {
        detectedProviderId = provider.id;
        break;
      }
    }

    const lead = await prisma.lead.create({
      data: {
        localName: "",
        ownerName: "",
        email: "",
        cartaType: "LINK",
        cartaUrl,
        cartaStatus: "PENDING",
        detectedProviderId,
      },
    });

    return NextResponse.json({ id: lead.id, detectedProviderId });
  } catch (error) {
    console.error("[SubirCarta POST]", error);
    return NextResponse.json(
      { error: "Error al crear el lead." },
      { status: 500 },
    );
  }
}
