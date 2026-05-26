/**
 * Document extractor — extracts menu text from PDF, Word (.docx), and Excel (.xlsx)
 * files, then sends to Claude for structured extraction.
 */
import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract text content from a document file (PDF, Word, Excel).
 * Downloads from URL, parses text, sends to Claude for structuring.
 */
export async function extractFromDocument(fileUrl: string, config?: any): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const visionThreshold = config?.visionFallbackThreshold ?? 200;
  const maxTextChars = config?.maxTextChars ?? 30000;
  const preferVision = config?.preferVision ?? true;

  console.log("[Document] Config:", { visionThreshold, maxTextChars, preferVision });

  // Support multiple files (comma-separated URLs)
  const urls = fileUrl.split(",").map(u => u.trim()).filter(Boolean).slice(0, 5);
  let fullText = "";
  let pdfBuffer: Buffer | null = null; // Keep first PDF buffer for Vision fallback

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";

      let text = "";
      if (ext === "pdf") {
        try {
          text = await extractPdfText(buffer);
        } catch (e) {
          console.error("[Document] pdf-parse failed:", (e as Error).message);
        }
        if (!pdfBuffer) pdfBuffer = buffer;
      } else if (ext === "docx" || ext === "doc") {
        text = await extractWordText(buffer);
      } else if (ext === "xlsx" || ext === "xls") {
        text = await extractExcelText(buffer);
      } else {
        // Try PDF first, then Word
        text = await extractPdfText(buffer).catch(() => extractWordText(buffer));
      }

      if (text.trim()) fullText += text + "\n\n";
    } catch (e) {
      console.error("[Document] Error processing URL:", (e as Error).message);
    }
  }

  // Fallback: if pdf-parse returned no/little text, send PDF directly to Claude as base64 document
  if (fullText.trim().length < visionThreshold && pdfBuffer && preferVision) {
    console.log(`[Document] Text extraction insufficient (${fullText.trim().length} chars < ${visionThreshold}), using Claude PDF Vision fallback`);
    return extractPdfWithVision(pdfBuffer, apiKey);
  }

  if (!fullText.trim()) throw new Error("No text could be extracted from documents");

  // Limit text for Claude
  const trimmedText = fullText.slice(0, maxTextChars);

  // Send to Claude for menu structuring
  const prompt = `Analiza el siguiente texto extraído de un documento de carta/menú de restaurante.
Extrae TODOS los platos que puedas identificar y organízalos por categoría.
IMPORTANTE: Solo extrae platos reales que estén en el texto. NO inventes ni agregues platos.
Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Reglas:
- Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0.
- No inventes platos, solo extrae lo que está en el texto.
- Si hay secciones/títulos que parecen categorías, úsalas.
- SOLO JSON.

TEXTO DEL DOCUMENTO:
${trimmedText}`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) throw new Error(`Claude error: ${claudeRes.status}`);
  const data = await claudeRes.json();
  const responseText = data.content?.[0]?.text || "";

  // If response was truncated (max_tokens hit), try to find the last complete JSON
  const stopReason = data.stop_reason;
  let jsonCandidate = responseText;
  if (stopReason === "end_turn") {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in Claude response");
    jsonCandidate = match[0];
  } else {
    // Truncated — find the opening brace and take everything after it
    const braceIdx = responseText.indexOf("{");
    if (braceIdx === -1) throw new Error("No JSON found in truncated Claude response");
    jsonCandidate = responseText.slice(braceIdx);
    console.log(`[Document] Claude response truncated (stop_reason: ${stopReason}), attempting JSON repair on ${jsonCandidate.length} chars`);
  }

  const parsed = repairAndParseJson(jsonCandidate);

  return buildResult(parsed);
}

// ─── PDF Vision fallback ──────────────────────────────────────────────

// Max PDF size (raw bytes) to send as a single PDF document (~4.5MB base64 ≈ 3.3MB raw)
const MAX_SINGLE_PDF_BYTES = 3.3 * 1024 * 1024;
// Max images per Claude Vision request
const MAX_IMAGES_PER_REQUEST = 10;
// Scale factor for rendering PDF pages to images (1.5 = good quality, not too heavy)
const PDF_RENDER_SCALE = 1.5;

const VISION_PROMPT = `Analiza este PDF de carta/menú de restaurante.
Extrae TODOS los platos que puedas identificar y organízalos por categoría.
IMPORTANTE: Solo extrae platos reales que estén en el documento. NO inventes platos.
Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Reglas:
- Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0.
- SOLO JSON.`;

async function extractPdfWithVision(buffer: Buffer, apiKey: string): Promise<ExtractionResult> {
  // Small PDFs: send as a single base64 document (fast path)
  if (buffer.byteLength <= MAX_SINGLE_PDF_BYTES) {
    console.log(`[Document] PDF size ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB — sending as single document`);
    return sendPdfDocumentToVision(buffer, apiKey, VISION_PROMPT);
  }

  // Large PDFs: try rendering pages to JPEG images, fallback to splitting PDF into per-page docs
  console.log(`[Document] PDF too large for single doc (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB), trying page rendering`);
  let pageImages: Buffer[];
  try {
    pageImages = await renderPdfPagesToImages(buffer);
    console.log(`[Document] Rendered ${pageImages.length} pages to JPEG (${pageImages.reduce((s, img) => s + img.byteLength, 0) / 1024 / 1024 | 0}MB total)`);
  } catch (renderErr) {
    console.warn(`[Document] Page rendering failed: ${(renderErr as Error).message} — splitting PDF into per-page documents`);
    return extractLargePdfByPages(buffer, apiKey);
  }

  const allCategories: any[] = [];
  let restaurantName = "Restaurante";

  // Send images in batches
  for (let i = 0; i < pageImages.length; i += MAX_IMAGES_PER_REQUEST) {
    const batch = pageImages.slice(i, i + MAX_IMAGES_PER_REQUEST);
    const batchStart = i + 1;
    const batchEnd = i + batch.length;

    console.log(`[Document] Sending batch pages ${batchStart}-${batchEnd} (${batch.length} images, ${(batch.reduce((s, b) => s + b.byteLength, 0) / 1024).toFixed(0)}KB)`);

    const prompt = i === 0
      ? VISION_PROMPT
      : `Analiza estas páginas de carta/menú (páginas ${batchStart}-${batchEnd}).
Extrae TODOS los platos y organízalos por categoría. SOLO JSON:
{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Reglas: Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0. SOLO JSON.`;

    try {
      const content: any[] = batch.map(imgBuf => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: imgBuf.toString("base64") },
      }));
      content.push({ type: "text", text: prompt });

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 32000,
          messages: [{ role: "user", content }],
        }),
      });

      if (!claudeRes.ok) {
        const errBody = await claudeRes.text().catch(() => "");
        throw new Error(`Claude Vision error: ${claudeRes.status} ${errBody.slice(0, 200)}`);
      }

      const data = await claudeRes.json();
      const responseText = data.content?.[0]?.text || "";
      const parsed = repairAndParseJson(responseText);

      if (parsed.restaurantName && parsed.restaurantName !== "Restaurante") {
        restaurantName = parsed.restaurantName;
      }
      if (parsed.categories) allCategories.push(...parsed.categories);
    } catch (e) {
      console.error(`[Document] Batch pages ${batchStart}-${batchEnd} failed:`, (e as Error).message);
    }
  }

  if (allCategories.length === 0) throw new Error("No categories extracted from any page batch");

  // Merge categories with the same name
  const mergedMap = new Map<string, any>();
  for (const cat of allCategories) {
    const key = (cat.name || "General").toLowerCase().trim();
    if (mergedMap.has(key)) {
      mergedMap.get(key).dishes.push(...(cat.dishes || []));
    } else {
      mergedMap.set(key, { ...cat, dishes: [...(cat.dishes || [])] });
    }
  }
  const mergedCategories = Array.from(mergedMap.values());

  console.log("[Document] PDF Vision (images) extracted", mergedCategories.reduce((s: number, c: any) => s + (c.dishes?.length || 0), 0), "dishes from", pageImages.length, "pages");

  return buildResult({ restaurantName, categories: mergedCategories });
}

/** Render each page of a PDF to a JPEG image buffer using pdfjs-dist + @napi-rs/canvas */
async function renderPdfPagesToImages(buffer: Buffer): Promise<Buffer[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");

  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;
  const images: Buffer[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");

      // Fill white background (PDFs may have transparent background)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;

      // Encode as JPEG (good compression for menu images)
      const jpegBuffer = canvas.toBuffer("image/jpeg", 80);
      images.push(Buffer.from(jpegBuffer));

      console.log(`[Document] Page ${i}/${doc.numPages}: ${(jpegBuffer.byteLength / 1024).toFixed(0)}KB`);
    } catch (e) {
      console.warn(`[Document] Page ${i}/${doc.numPages} render failed: ${(e as Error).message}, skipping`);
    }
  }

  if (images.length === 0) {
    throw new Error("All PDF pages failed to render");
  }

  await doc.destroy();
  return images;
}

/** Send a small PDF as a single base64 document (original fast path) */
async function sendPdfDocumentToVision(buffer: Buffer, apiKey: string, prompt: string): Promise<ExtractionResult> {
  const base64 = buffer.toString("base64");
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });

  if (!claudeRes.ok) {
    const errBody = await claudeRes.text().catch(() => "");
    throw new Error(`Claude PDF Vision error: ${claudeRes.status} ${errBody.slice(0, 200)}`);
  }
  const data = await claudeRes.json();
  const responseText = data.content?.[0]?.text || "";
  const parsed = repairAndParseJson(responseText);

  console.log("[Document] PDF Vision extracted", (parsed.categories || []).reduce((s: number, c: any) => s + (c.dishes?.length || 0), 0), "dishes");
  return buildResult(parsed);
}

/** Split a large PDF into per-page PDFs and send each to Claude individually */
async function extractLargePdfByPages(buffer: Buffer, apiKey: string): Promise<ExtractionResult> {
  const { PDFDocument } = await import("pdf-lib");
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();
  console.log(`[Document] Splitting ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB PDF into ${pageCount} single-page documents`);

  const allCategories: any[] = [];
  let restaurantName = "Restaurante";

  for (let i = 0; i < pageCount; i++) {
    try {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);
      const singleBytes = await singleDoc.save();
      const singleBuffer = Buffer.from(singleBytes);

      console.log(`[Document] Page ${i + 1}/${pageCount}: ${(singleBuffer.byteLength / 1024).toFixed(0)}KB`);

      const prompt = i === 0
        ? VISION_PROMPT
        : `Analiza esta página de carta/menú (página ${i + 1}).
Extrae TODOS los platos y organízalos por categoría. SOLO JSON:
{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Reglas: Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0. SOLO JSON.`;

      const parsed = await sendPdfPageToVision(singleBuffer, apiKey, prompt);

      if (parsed.restaurantName && parsed.restaurantName !== "Restaurante") {
        restaurantName = parsed.restaurantName;
      }
      if (parsed.categories) {
        allCategories.push(...parsed.categories);
        const pageDishes = parsed.categories.reduce((s: number, c: any) => s + (c.dishes?.length || 0), 0);
        console.log(`[Document] Page ${i + 1}: ${pageDishes} dishes extracted`);
      }
    } catch (e) {
      console.warn(`[Document] Page ${i + 1}/${pageCount} failed: ${(e as Error).message}`);
    }
  }

  if (allCategories.length === 0) throw new Error("No categories extracted from any page");

  // Merge categories with the same name
  const mergedMap = new Map<string, any>();
  for (const cat of allCategories) {
    const key = (cat.name || "General").toLowerCase().trim();
    if (mergedMap.has(key)) {
      mergedMap.get(key).dishes.push(...(cat.dishes || []));
    } else {
      mergedMap.set(key, { ...cat, dishes: [...(cat.dishes || [])] });
    }
  }
  const mergedCategories = Array.from(mergedMap.values());
  const totalDishes = mergedCategories.reduce((s: number, c: any) => s + (c.dishes?.length || 0), 0);
  console.log(`[Document] PDF split extraction complete: ${totalDishes} dishes from ${pageCount} pages`);

  return buildResult({ restaurantName, categories: mergedCategories });
}

/** Send a single-page PDF to Claude and return raw parsed JSON (not ExtractionResult) */
async function sendPdfPageToVision(buffer: Buffer, apiKey: string, prompt: string): Promise<any> {
  const base64 = buffer.toString("base64");
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: prompt },
      ]}],
    }),
  });

  if (!claudeRes.ok) {
    const errBody = await claudeRes.text().catch(() => "");
    throw new Error(`Claude PDF Vision error: ${claudeRes.status} ${errBody.slice(0, 200)}`);
  }
  const data = await claudeRes.json();
  const responseText = data.content?.[0]?.text || "";
  return repairAndParseJson(responseText);
}

/** Parse JSON from Claude response with robust repair for truncated output */
function repairAndParseJson(responseText: string): any {
  const match = responseText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Claude response");

  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch {
    let jsonStr = match[0]
      .replace(/,\s*\{[^}]*$/, "")
      .replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "")
      .replace(/,\s*"[^"]*$/, "")
      .replace(/,\s*$/, "");
    const quoteCount = (jsonStr.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) jsonStr += '"';
    let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
    for (let i = 0; i < o - c; i++) jsonStr += "]";
    let oo = 0, cc = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") cc++; }
    for (let i = 0; i < oo - cc; i++) jsonStr += "}";
    try { parsed = JSON.parse(jsonStr); } catch {
      for (let end = jsonStr.length; end > 100; end--) {
        let attempt = jsonStr.slice(0, end);
        const bk = (attempt.match(/\[/g) || []).length - (attempt.match(/\]/g) || []).length;
        const br = (attempt.match(/\{/g) || []).length - (attempt.match(/\}/g) || []).length;
        for (let i = 0; i < bk; i++) attempt += "]";
        for (let i = 0; i < br; i++) attempt += "}";
        try { parsed = JSON.parse(attempt); break; } catch {}
      }
      if (!parsed) throw new Error("Could not repair truncated JSON");
    }
  }
  return parsed;
}

/** Transform parsed Claude JSON into ExtractionResult with Unsplash photos */
async function buildResult(parsed: any): Promise<ExtractionResult> {
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
  const photoMap = new Map<string, string>();
  if (UNSPLASH_KEY) {
    const allDishes = (parsed.categories || []).flatMap((c: any) =>
      (c.dishes || []).map((d: any) => ({ name: d.name, category: c.name }))
    ).filter((d: any) => d.name).slice(0, 15);
    await Promise.allSettled(allDishes.map(async (d: any) => {
      try {
        for (const query of [`${d.name} food`, `${d.category} ${d.name} restaurant`, `${d.category} food dish`]) {
          const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            const url = data.results?.[0]?.urls?.regular;
            if (url) { photoMap.set(d.name, url); return; }
          }
        }
      } catch {}
    }));
  }

  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name) continue;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price: typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
        imageUrl: photoMap.get(dish.name) || null,
        category: cat.name || "General",
        diet: dish.diet || "OMNIVORE",
        isSpicy: dish.isSpicy || false,
      });
    }
  }

  return {
    restaurantName: parsed.restaurantName || "Restaurante",
    dishes,
    logoUrl: null,
    bannerUrl: null,
  };
}

// ─── Parsers ─────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as any).default || mod;
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function extractWordText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractExcelText(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    for (const row of rows) {
      const line = (row as any[]).filter(Boolean).join(" | ");
      if (line.trim()) lines.push(line);
    }
  }
  return lines.join("\n");
}
