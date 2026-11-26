// Detección del proveedor de una carta por su link (Fudo, Toteat, Instagram, etc.).
// Compartido entre /subircarta (leads web) y /ventas (captura en terreno).

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

export async function detectProvider(
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

