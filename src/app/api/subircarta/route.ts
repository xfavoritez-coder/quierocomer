import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";
import { getCity } from "@/lib/geoip";

/** Try to detect the menu provider: first by domain, then by fetching HTML and scanning for signatures. */
/** Known redirect domains — we resolve the real URL before detecting provider */
const REDIRECT_DOMAINS = ["l.instagram.com", "lm.facebook.com", "t.co", "bit.ly", "tinyurl.com", "shorturl.at"];

async function resolveRedirect(url: string): Promise<string> {
  const hostname = new URL(url).hostname.toLowerCase();
  if (!REDIRECT_DOMAINS.some(d => hostname.includes(d))) return url;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "QuieroComer-Bot/1.0" },
    });
    return res.url || url;
  } catch {
    // Try extracting from query params (Instagram wraps in ?u=)
    try {
      const u = new URL(url);
      const wrapped = u.searchParams.get("u");
      if (wrapped) return wrapped;
    } catch {}
    return url;
  }
}

async function detectProvider(
  cartaUrl: string,
  providers: { id: string; domainPatterns: string[]; htmlSignatures: string[] }[],
): Promise<{ providerId: string | null; resolvedUrl?: string }> {
  // Step 0: resolve redirects (Instagram, Facebook, bit.ly, etc.)
  const resolvedUrl = await resolveRedirect(cartaUrl);
  const urlChanged = resolvedUrl !== cartaUrl;
  const hostname = new URL(resolvedUrl).hostname.toLowerCase();

  if (urlChanged) console.log(`[SubirCarta] Resolved redirect: ${new URL(cartaUrl).hostname} → ${hostname}`);

  // Pass 1: domain match on resolved URL
  for (const p of providers) {
    if (p.domainPatterns.some((pat) => hostname.includes(pat.toLowerCase()))) {
      return { providerId: p.id, resolvedUrl: urlChanged ? resolvedUrl : undefined };
    }
  }

  // Pass 2: fetch HTML and scan for signatures
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(resolvedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "QuieroComer-Bot/1.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return { providerId: null, resolvedUrl: urlChanged ? resolvedUrl : undefined };

    // Read only first 100KB to avoid downloading huge pages
    const reader = res.body?.getReader();
    if (!reader) return { providerId: null, resolvedUrl: urlChanged ? resolvedUrl : undefined };

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
        return { providerId: p.id, resolvedUrl: urlChanged ? resolvedUrl : undefined };
      }
    }
  } catch {
    // Fetch failed (timeout, DNS, etc.) — skip HTML detection
  }

  return { providerId: null, resolvedUrl: urlChanged ? resolvedUrl : undefined };
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
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cartaUrl);
    } catch {
      return NextResponse.json(
        { error: "La URL ingresada no es válida." },
        { status: 400 },
      );
    }

    // Block provider homepages — user likely forgot to paste their specific menu URL
    const path = parsedUrl.pathname.replace(/\/+$/, "");
    if (!path || path === "") {
      const providers = await prisma.menuProvider.findMany({ select: { domainPatterns: true, name: true } });
      const host = parsedUrl.hostname.toLowerCase();
      const matched = providers.find(p => p.domainPatterns.some(d => host.includes(d.toLowerCase())));
      if (matched) {
        return NextResponse.json(
          { error: `Esa es la página principal de ${matched.name}. Pega la URL de tu carta específica, no la del sitio.` },
          { status: 400 },
        );
      }
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
