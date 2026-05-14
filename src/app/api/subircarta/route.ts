import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Try to detect the menu provider: first by domain, then by fetching HTML and scanning for signatures. */
async function detectProvider(
  cartaUrl: string,
  providers: { id: string; domainPatterns: string[]; htmlSignatures: string[] }[],
): Promise<string | null> {
  const hostname = new URL(cartaUrl).hostname.toLowerCase();

  // Pass 1: domain match
  for (const p of providers) {
    if (p.domainPatterns.some((pat) => hostname.includes(pat.toLowerCase()))) {
      return p.id;
    }
  }

  // Pass 2: fetch HTML and scan for signatures
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(cartaUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "QuieroComer-Bot/1.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    // Read only first 100KB to avoid downloading huge pages
    const reader = res.body?.getReader();
    if (!reader) return null;

    let html = "";
    const decoder = new TextDecoder();
    const MAX_BYTES = 100_000;
    let bytesRead = 0;

    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.length;
    }
    reader.cancel();

    const htmlLower = html.toLowerCase();
    for (const p of providers) {
      if (p.htmlSignatures.some((sig) => htmlLower.includes(sig.toLowerCase()))) {
        return p.id;
      }
    }
  } catch {
    // Fetch failed (timeout, DNS, etc.) — skip HTML detection
  }

  return null;
}

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
    try {
      new URL(cartaUrl);
    } catch {
      return NextResponse.json(
        { error: "La URL ingresada no es válida." },
        { status: 400 },
      );
    }

    const providers = await prisma.menuProvider.findMany({
      select: { id: true, domainPatterns: true, htmlSignatures: true },
    });

    const detectedProviderId = await detectProvider(cartaUrl, providers);

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
