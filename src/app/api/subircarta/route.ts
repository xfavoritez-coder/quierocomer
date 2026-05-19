import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";

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
    // Rate limit
    const ip = getClientIp(req);
    const rl = rateLimit(`subircarta:${ip}`, RATE_LIMITS.subircarta);
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${formatRetryAfter(rl.retryAfterMs)}.` },
        { status: 429 },
      );
    }

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

    // Check for duplicate: reuse incomplete lead with same URL (not yet processed)
    const existing = await prisma.lead.findFirst({
      where: { cartaUrl, email: "", cartaStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({ id: existing.id, detectedProviderId: existing.detectedProviderId });
    }

    const providers = await prisma.menuProvider.findMany({
      select: { id: true, domainPatterns: true, htmlSignatures: true },
    });

    let detectedProviderId = await detectProvider(cartaUrl, providers);

    // Auto-create unknown providers so we track every domain that comes in
    if (!detectedProviderId) {
      const hostname = new URL(cartaUrl).hostname.toLowerCase().replace(/^www\./, "");
      const domainName = hostname.split(".").slice(0, -1).join(".") || hostname;
      const displayName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
      try {
        const newProvider = await prisma.menuProvider.create({
          data: {
            name: displayName,
            domainPatterns: [hostname],
            htmlSignatures: [],
            status: "UNKNOWN",
            notes: `Auto-detectado desde ${cartaUrl}`,
          },
        });
        detectedProviderId = newProvider.id;
        console.log(`[SubirCarta] Auto-created provider "${displayName}" (${hostname})`);
      } catch {
        // Race condition: provider already exists from concurrent request
        const existing = await prisma.menuProvider.findFirst({
          where: { domainPatterns: { has: hostname } },
          select: { id: true },
        });
        if (existing) detectedProviderId = existing.id;
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
