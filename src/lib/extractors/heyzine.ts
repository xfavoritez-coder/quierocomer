/**
 * Heyzine flip-book extractor.
 * Heyzine renders PDFs as JS-based flip-books — scrapers can't read the content.
 * Strategy: parse the page's flipbookcfg to get the PDF filename, download it
 * from the CDN, and delegate to the document extractor (pdf-parse + Claude Vision).
 */
import type { ExtractionResult } from "./types";
import { extractFromDocument } from "./document";

const HEYZINE_CDN = "https://cdnc.heyzine.com/files/uploaded/";

/**
 * Extract the PDF filename from Heyzine's flipbookcfg JS variable.
 * The config is embedded inline as: flipbookcfg = { ... "name":"<hash>.pdf" ... }
 */
function extractPdfName(html: string): string | null {
  // Try the config object first
  const cfgMatch = html.match(/flipbookcfg\s*=\s*\{[^}]*"name"\s*:\s*"([^"]+\.pdf)"/);
  if (cfgMatch) return cfgMatch[1];

  // Fallback: look for any CDN PDF reference
  const cdnMatch = html.match(/cdnc\.heyzine\.com\/files\/uploaded\/([a-f0-9]+\.pdf)/);
  if (cdnMatch) return cdnMatch[1];

  // Fallback: look for heyzine.load() call with PDF path
  const loadMatch = html.match(/heyzine\.load\s*\([^)]*['"]([^'"]+\.pdf)['"]/);
  if (loadMatch) {
    const path = loadMatch[1];
    return path.split("/").pop() || null;
  }

  return null;
}

export async function extractHeyzine(cartaUrl: string): Promise<ExtractionResult> {
  console.log("[Heyzine] Fetching flip-book page:", cartaUrl);

  const res = await fetch(cartaUrl, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Heyzine page fetch failed: ${res.status}`);

  // Read only first 50KB — the config is near the top
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  let html = "";
  const decoder = new TextDecoder();
  while (html.length < 50000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel();

  const pdfName = extractPdfName(html);
  if (!pdfName) throw new Error("Could not find PDF filename in Heyzine page");

  const pdfUrl = HEYZINE_CDN + pdfName;
  console.log("[Heyzine] Resolved PDF URL:", pdfUrl);

  // Delegate to document extractor (handles pdf-parse → Claude Vision fallback)
  return extractFromDocument(pdfUrl, { preferVision: true });
}
