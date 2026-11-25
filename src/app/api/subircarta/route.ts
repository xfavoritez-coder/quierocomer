import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";
import { getCity } from "@/lib/geoip";
import { detectProvider } from "@/lib/extractors/detectProvider";


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
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cartaUrl);
    } catch {
      return NextResponse.json(
        { error: "La URL ingresada no es válida." },
        { status: 400 },
      );
    }

    // Require a real domain (must contain a dot — "https://yyyyy" is syntactically valid but not a real URL)
    if (!parsedUrl.hostname.includes(".")) {
      return NextResponse.json(
        { error: "Ingresa una URL completa con dominio válido (ej: https://tusitio.cl/carta)." },
        { status: 400 },
      );
    }

    // Check for duplicate: reuse incomplete lead with same URL (not yet processed)
    // Only reuse if created within the last 30 minutes to avoid stale leads
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await prisma.lead.findFirst({
      where: { cartaUrl, email: "", cartaStatus: "PENDING", createdAt: { gte: thirtyMinAgo } },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({ id: existing.id, detectedProviderId: existing.detectedProviderId });
    }

    const providers = await prisma.menuProvider.findMany({
      select: { id: true, domainPatterns: true, htmlSignatures: true },
    });

    const { providerId: detectedProviderIdRaw, resolvedUrl } = await detectProvider(cartaUrl, providers);
    let detectedProviderId = detectedProviderIdRaw;
    // If redirect was resolved, use the real URL for extraction
    const effectiveUrl = resolvedUrl || cartaUrl;

    // Auto-create unknown providers so we track every domain that comes in
    if (!detectedProviderId) {
      const hostname = new URL(effectiveUrl).hostname.toLowerCase().replace(/^www\./, "");
      const domainName = hostname.split(".").slice(0, -1).join(".") || hostname;
      const displayName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
      try {
        const newProvider = await prisma.menuProvider.create({
          data: {
            name: displayName,
            domainPatterns: [hostname],
            htmlSignatures: [],
            status: "UNKNOWN",
            notes: `Auto-detectado desde ${effectiveUrl}`,
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
        cartaUrl: effectiveUrl, // Store resolved URL, not the redirect wrapper
        cartaStatus: "PENDING",
        detectedProviderId,
        ip,
      },
    });

    // Resolve city in background (fire-and-forget)
    getCity(ip).then((city) => {
      if (city) prisma.lead.update({ where: { id: lead.id }, data: { city } }).catch(() => {});
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
