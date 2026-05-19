/**
 * Document extractor — extracts menu text from PDF, Word (.docx), and Excel (.xlsx)
 * files, then sends to Claude for structured extraction.
 */
import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract text content from a document file (PDF, Word, Excel).
 * Downloads from URL, parses text, sends to Claude for structuring.
 */
export async function extractFromDocument(fileUrl: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

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
        if (!text.trim() && !pdfBuffer) pdfBuffer = buffer;
        else if (!pdfBuffer) pdfBuffer = buffer;
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
  if (fullText.trim().length < 200 && pdfBuffer) {
    console.log("[Document] Text extraction insufficient, using Claude PDF reading fallback");
    return extractPdfWithVision(pdfBuffer, apiKey);
  }

  if (!fullText.trim()) throw new Error("No text could be extracted from documents");

  // Limit text to ~30KB for Claude (large menus can have many pages)
  const trimmedText = fullText.slice(0, 30000);

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
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) throw new Error(`Claude error: ${claudeRes.status}`);
  const data = await claudeRes.json();
  const responseText = data.content?.[0]?.text || "";

  const match = responseText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Claude response");

  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch {
    // Try to fix truncated JSON
    let jsonStr = match[0].replace(/,\s*\{[^}]*$/, "").replace(/,\s*$/, "");
    let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
    for (let i = 0; i < o - c; i++) jsonStr += "]";
    let oo = 0, cc = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") cc++; }
    for (let i = 0; i < oo - cc; i++) jsonStr += "}";
    parsed = JSON.parse(jsonStr);
  }

  // Fetch Unsplash photos
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

// ─── PDF Vision fallback (sends PDF as base64 document to Claude) ──────

async function extractPdfWithVision(buffer: Buffer, apiKey: string): Promise<ExtractionResult> {
  const base64 = buffer.toString("base64");
  // Claude supports PDFs up to ~32MB as base64 documents
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: `Analiza este PDF de carta/menú de restaurante.
Extrae TODOS los platos que puedas identificar y organízalos por categoría.
IMPORTANTE: Solo extrae platos reales que estén en el documento. NO inventes platos.
Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Reglas:
- Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0.
- SOLO JSON.` },
        ],
      }],
    }),
  });

  if (!claudeRes.ok) throw new Error(`Claude PDF Vision error: ${claudeRes.status}`);
  const data = await claudeRes.json();
  const responseText = data.content?.[0]?.text || "";

  const match = responseText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Claude PDF Vision response");

  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch {
    let jsonStr = match[0].replace(/,\s*\{[^}]*$/, "").replace(/,\s*$/, "");
    let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
    for (let i = 0; i < o - c; i++) jsonStr += "]";
    let oo = 0, cc = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") cc++; }
    for (let i = 0; i < oo - cc; i++) jsonStr += "}";
    parsed = JSON.parse(jsonStr);
  }

  console.log("[Document] PDF Vision extracted", (parsed.categories || []).reduce((s: number, c: any) => s + (c.dishes?.length || 0), 0), "dishes");

  // Fetch Unsplash photos
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
