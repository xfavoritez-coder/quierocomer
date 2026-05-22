/**
 * Google Drive extractor — handles share links to PDFs hosted on Drive.
 *
 * Supported URL formats:
 *   https://drive.google.com/file/d/{FILE_ID}/view?usp=...
 *   https://drive.google.com/open?id={FILE_ID}
 *   https://drive.google.com/uc?id={FILE_ID}&export=download
 *
 * Strategy:
 *   1. Extract the file ID from the URL.
 *   2. Build a direct-download URL: https://drive.google.com/uc?export=download&id={FILE_ID}
 *   3. Download the file (following Google's virus-warning redirect if needed).
 *   4. Extract text from the PDF using pdf-parse.
 *   5. If text is insufficient, send the PDF as a base64 document to Claude.
 *   6. Structure the extracted text into ExtractedDish[] via Claude.
 */

import type { ExtractionResult, ExtractedDish } from "./types";
import { PDFDocument } from "pdf-lib";

// ─── URL detection ────────────────────────────────────────────────────────────

/** Returns true if the URL points to a Google Drive file. */
export function isGoogleDriveUrl(url: string): boolean {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    if (!hostname.includes("drive.google.com")) return false;
    // /file/d/{id}/view  or  /open?id=  or  /uc?id=
    return (
      /^\/file\/d\/[^/]+/.test(pathname) ||
      pathname === "/open" && !!searchParams.get("id") ||
      pathname === "/uc" && !!searchParams.get("id")
    );
  } catch {
    return false;
  }
}

/** Extract the Google Drive file ID from any supported share URL. */
function extractFileId(url: string): string | null {
  try {
    const { pathname, searchParams } = new URL(url);
    // /file/d/{id}/...
    const match = pathname.match(/\/file\/d\/([^/]+)/);
    if (match) return match[1];
    // ?id=
    return searchParams.get("id");
  } catch {
    return null;
  }
}

/** Build the direct-download URL for a Drive file. */
function buildDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Download a file from Google Drive, handling the "large file" virus-warning
 * confirmation page that Drive shows for files > 100 MB (or occasionally others).
 *
 * Returns the raw binary buffer and the detected content type.
 */
async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; contentType: string }> {
  const downloadUrl = buildDownloadUrl(fileId);
  console.log(`[GoogleDrive] Downloading file ${fileId} via ${downloadUrl}`);

  const res = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Google Drive download failed: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Google shows an HTML confirmation page for "large" files.
  // Detect it and follow the confirm link.
  if (contentType.includes("text/html")) {
    const html = await res.text();

    // Look for the confirm download link pattern
    const confirmMatch = html.match(/href="(\/uc\?[^"]*export=download[^"]*confirm=[^"]+)"/i)
      || html.match(/action="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/i)
      || html.match(/href="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/i);

    if (confirmMatch) {
      const confirmHref = confirmMatch[1];
      const confirmUrl = confirmHref.startsWith("http")
        ? confirmHref
        : `https://drive.google.com${confirmHref}`;

      console.log("[GoogleDrive] Following confirmation redirect for large file");
      const confirmRes = await fetch(confirmUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!confirmRes.ok) {
        throw new Error(`Google Drive confirm download failed: HTTP ${confirmRes.status}`);
      }
      const buffer = Buffer.from(await confirmRes.arrayBuffer());
      const ct = confirmRes.headers.get("content-type") || "application/pdf";
      return { buffer, contentType: ct };
    }

    // Also handle drive.usercontent.google.com pattern (newer Drive URLs)
    const usercontent = html.match(/https:\/\/drive\.usercontent\.google\.com\/[^"'\s]+/);
    if (usercontent) {
      const ucRes = await fetch(usercontent[0], {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!ucRes.ok) {
        throw new Error(`Google Drive usercontent download failed: HTTP ${ucRes.status}`);
      }
      const buffer = Buffer.from(await ucRes.arrayBuffer());
      const ct = ucRes.headers.get("content-type") || "application/pdf";
      return { buffer, contentType: ct };
    }

    throw new Error(
      "Google Drive returned an HTML page but no download link could be found. " +
      "The file may be set to 'Restricted' access — ensure it is shared as 'Anyone with the link'."
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as any).default || mod;
  const result = await pdfParse(buffer);
  return result.text || "";
}

// ─── Claude helpers ───────────────────────────────────────────────────────────

const MENU_JSON_SCHEMA = `{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}`;

const RULES = `Reglas:
- Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0.
- No inventes platos, solo extrae lo que está en el documento.
- Si hay secciones/títulos que parecen categorías, úsalas.
- SOLO JSON.`;

async function claudeExtractFromText(text: string, apiKey: string): Promise<any> {
  const prompt = `Analiza el siguiente texto extraído de un documento de carta/menú de restaurante.
Extrae TODOS los platos que puedas identificar y organízalos por categoría.
IMPORTANTE: Solo extrae platos reales que estén en el texto. NO inventes ni agregues platos.
Responde SOLO con JSON:
${MENU_JSON_SCHEMA}
${RULES}

TEXTO DEL DOCUMENTO:
${text.slice(0, 30000)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

/**
 * Split a large PDF into smaller chunks and send each to Claude as a PDF document.
 * Merges all results into a single response.
 * Uses pdf-lib to split pages.
 */
async function claudeExtractFromLargePdf(buffer: Buffer, apiKey: string): Promise<string> {
  const pdf = await PDFDocument.load(new Uint8Array(buffer));
  const totalPages = pdf.getPageCount();
  console.log(`[GoogleDrive] PDF has ${totalPages} pages, splitting into chunks`);

  // Split into chunks of 2 pages to stay under 4.5MB base64 (image-heavy PDFs)
  const PAGES_PER_CHUNK = 2;
  const chunks: string[] = [];

  for (let start = 0; start < totalPages; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK, totalPages);
    const chunkPdf = await PDFDocument.create();
    const pages = await chunkPdf.copyPages(pdf, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach(p => chunkPdf.addPage(p));
    const chunkBuf = Buffer.from(await chunkPdf.save());
    const base64 = chunkBuf.toString("base64");
    const sizeMB = (base64.length / 1024 / 1024).toFixed(1);
    console.log(`[GoogleDrive] Chunk pages ${start + 1}-${end}: ${sizeMB}MB`);

    // Skip chunks over 4.5MB (Claude limit)
    if (base64.length > 4.5 * 1024 * 1024) {
      console.warn(`[GoogleDrive] Chunk too large (${sizeMB}MB), skipping`);
      continue;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            {
              type: "text",
              text: `Analiza estas páginas (${start + 1}-${end} de ${totalPages}) de un menú de restaurante.
Extrae TODOS los platos que encuentres. Responde SOLO con JSON:
${MENU_JSON_SCHEMA}
${RULES}`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      console.warn(`[GoogleDrive] Claude error for chunk ${start + 1}-${end}: ${res.status}`);
      continue;
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    if (text) chunks.push(text);
  }

  if (chunks.length === 0) throw new Error("Claude could not extract from any PDF chunk");

  // If single chunk, return directly
  if (chunks.length === 1) return chunks[0];

  // Merge multiple chunks: ask Claude to combine
  const mergePrompt = `Tienes ${chunks.length} extracciones parciales de un menú de restaurante. Combínalas en un solo JSON, eliminando duplicados.
Responde SOLO con JSON:
${MENU_JSON_SCHEMA}

EXTRACCIONES:
${chunks.map((c, i) => `--- Parte ${i + 1} ---\n${c}`).join("\n\n")}`;

  const mergeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: mergePrompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!mergeRes.ok) throw new Error(`Claude merge error: ${mergeRes.status}`);
  const mergeData = await mergeRes.json();
  return mergeData.content?.[0]?.text || chunks[0];
}

// ─── JSON parsing (tolerant) ──────────────────────────────────────────────────

function parseClaudeJson(raw: string): any {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Claude response");

  try {
    return JSON.parse(match[0]);
  } catch {
    // Try to repair truncated JSON
    let jsonStr = match[0].replace(/,\s*\{[^}]*$/, "").replace(/,\s*$/, "");
    let o = 0, c = 0;
    for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
    for (let i = 0; i < o - c; i++) jsonStr += "]";
    let oo = 0, cc = 0;
    for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") cc++; }
    for (let i = 0; i < oo - cc; i++) jsonStr += "}";
    return JSON.parse(jsonStr);
  }
}

// ─── Unsplash photos (best-effort) ───────────────────────────────────────────

async function fetchUnsplashPhotos(
  parsed: any,
): Promise<Map<string, string>> {
  const photoMap = new Map<string, string>();
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
  if (!UNSPLASH_KEY) return photoMap;

  const allDishes = (parsed.categories || [])
    .flatMap((c: any) => (c.dishes || []).map((d: any) => ({ name: d.name, category: c.name })))
    .filter((d: any) => d.name)
    .slice(0, 15);

  await Promise.allSettled(
    allDishes.map(async (d: any) => {
      try {
        for (const query of [
          `${d.name} food`,
          `${d.category} ${d.name} restaurant`,
          `${d.category} food dish`,
        ]) {
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
            {
              headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
              signal: AbortSignal.timeout(5000),
            },
          );
          if (res.ok) {
            const data = await res.json();
            const url = data.results?.[0]?.urls?.regular;
            if (url) { photoMap.set(d.name, url); return; }
          }
        }
      } catch {}
    }),
  );

  return photoMap;
}

// ─── Build ExtractedDish[] from parsed JSON ───────────────────────────────────

function buildDishes(parsed: any, photoMap: Map<string, string>): ExtractedDish[] {
  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name) continue;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price:
          typeof dish.price === "number"
            ? dish.price
            : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
        imageUrl: photoMap.get(dish.name) || null,
        category: cat.name || "General",
        diet: dish.diet || "OMNIVORE",
        isSpicy: dish.isSpicy || false,
      });
    }
  }
  return dishes;
}

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Extract menu data from a Google Drive PDF share link.
 * Automatically converts the preview URL to a direct download and processes the PDF.
 */
export async function extractGoogleDrive(cartaUrl: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const fileId = extractFileId(cartaUrl);
  if (!fileId) throw new Error(`Could not extract file ID from Google Drive URL: ${cartaUrl}`);

  const { buffer, contentType } = await downloadDriveFile(fileId);

  if (buffer.length < 100) {
    throw new Error("Downloaded file is too small — it may not be accessible. Ensure the file is shared as 'Anyone with the link'.");
  }

  console.log(`[GoogleDrive] Downloaded ${buffer.length} bytes (${contentType}) for file ${fileId}`);

  // Only handle PDFs for now (Drive share links for menus are almost always PDFs)
  const isPdf = contentType.includes("pdf") || buffer.slice(0, 5).toString() === "%PDF-";

  if (!isPdf) {
    throw new Error(
      `Google Drive file is not a PDF (content-type: ${contentType}). ` +
      "Only PDF menus are supported via Drive links."
    );
  }

  // Try text extraction first
  let text = "";
  try {
    text = await extractPdfText(buffer);
    console.log(`[GoogleDrive] pdf-parse extracted ${text.trim().length} chars`);
  } catch (e) {
    console.warn("[GoogleDrive] pdf-parse failed:", (e as Error).message);
  }

  // If text extraction gave enough content, use Claude text path
  const TEXT_THRESHOLD = 200;
  let rawResponse: string;

  if (text.trim().length >= TEXT_THRESHOLD) {
    rawResponse = await claudeExtractFromText(text, apiKey);
  } else {
    // Fallback: split PDF into chunks and send each to Claude
    console.log("[GoogleDrive] Text insufficient, using chunked PDF Vision fallback");
    rawResponse = await claudeExtractFromLargePdf(buffer, apiKey);
  }

  const parsed = parseClaudeJson(rawResponse);

  const photoMap = await fetchUnsplashPhotos(parsed);
  const dishes = buildDishes(parsed, photoMap);

  console.log(`[GoogleDrive] Extracted ${dishes.length} dishes from file ${fileId}`);

  return {
    restaurantName: parsed.restaurantName || "Restaurante",
    dishes,
    logoUrl: null,
    bannerUrl: null,
  };
}
