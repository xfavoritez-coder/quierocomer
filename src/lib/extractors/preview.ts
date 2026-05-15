import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import { extractJusto } from "./justo";
import { extractUberEats } from "./ubereats";
import { extractQueresto } from "./queresto";
import { extractQuickPreview } from "./scrape";
import type { ExtractionResult, ExtractedDish } from "./types";

/** Quick preview from uploaded image via Claude Vision (Haiku for speed) */
async function extractQuickPreviewFromImage(imageUrl: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  let base64: string;
  let mediaType = "image/jpeg";
  try {
    const jpegBuffer = await sharp(buffer).jpeg({ quality: 80 }).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).toBuffer();
    base64 = jpegBuffer.toString("base64");
  } catch {
    base64 = buffer.toString("base64");
    if (imageUrl.endsWith(".png")) mediaType = "image/png";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: `Extrae los primeros 5 platos de esta foto de carta/menú.
Responde SOLO JSON: {"restaurantName":"...","dishes":[{"name":"...","description":"...","price":8990,"category":"..."}]}
Precios enteros ($8.990→8990). Máximo 5 platos. SOLO JSON.` },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude Vision error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON from Vision preview");

  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch { parsed = { dishes: [] }; }

  const dishes: ExtractedDish[] = [];
  for (const d of (parsed.dishes || [])) {
    if (!d.name) continue;
    dishes.push({
      name: d.name.trim(),
      description: d.description || "",
      price: typeof d.price === "number" ? d.price : parseInt(String(d.price).replace(/\D/g, ""), 10) || 0,
      imageUrl: null,
      category: d.category || "General",
    });
  }

  return {
    restaurantName: parsed.restaurantName || "Restaurante",
    dishes: dishes.slice(0, 5),
    logoUrl: null,
    bannerUrl: null,
  };
}

export interface LeadPreview {
  restaurantName: string;
  logoUrl: string | null;
  totalDishes: number;
  totalCategories: number;
  sampleDishes: {
    name: string;
    description: string;
    price: number;
    imageUrl: string | null;
    category: string;
  }[];
}

/** Re-upload an external image to Supabase, return public URL or null */
async function reuploadPreviewPhoto(externalUrl: string, leadId: string, index: number): Promise<string | null> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    const optimized = await sharp(buffer)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const fileName = `previews/${leadId}-${index}-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, optimized, { contentType: "image/webp", upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Fast extraction: fetch menu, grab logo + first 5 dishes, re-upload photos, save to lead.preview */
export async function generatePreview(leadId: string): Promise<LeadPreview> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { detectedProvider: { select: { name: true } } },
  });

  if (!lead || (!lead.cartaUrl && !lead.cartaFileUrl)) throw new Error("Lead has no cartaUrl or cartaFileUrl");

  let extraction: ExtractionResult;

  if (!lead.cartaUrl && lead.cartaFileUrl) {
    // Photo/document upload — use Vision API for preview
    extraction = await extractQuickPreviewFromImage(lead.cartaFileUrl);
  } else {
    switch (lead.detectedProvider?.name) {
      case "Justo":
        extraction = await extractJusto(lead.cartaUrl!);
        break;
      case "UberEats":
        extraction = await extractUberEats(lead.cartaUrl!);
        break;
      case "Queresto":
        extraction = await extractQueresto(lead.cartaUrl!);
        break;
      case "Fudo":
      case "Mercat":
      case "Gourmedia":
      default:
        extraction = await extractQuickPreview(lead.cartaUrl!, lead.detectedProvider?.name);
        break;
    }
  }

  const categories = new Set(extraction.dishes.map((d) => d.category));
  // Prioritize dishes with photos for the preview
  const withPhoto = extraction.dishes.filter((d) => d.imageUrl);
  const withoutPhoto = extraction.dishes.filter((d) => !d.imageUrl);
  const sample = [...withPhoto, ...withoutPhoto].slice(0, 5);

  // Re-upload sample photos to Supabase in parallel (~2-3s)
  const photoResults = await Promise.allSettled(
    sample.map((d, i) =>
      d.imageUrl ? reuploadPreviewPhoto(d.imageUrl, leadId, i) : Promise.resolve(null),
    ),
  );

  const sampleDishes = sample.map((d, i) => {
    const result = photoResults[i];
    const uploadedUrl = result.status === "fulfilled" ? result.value : null;
    return {
      name: d.name,
      description: d.description || "",
      price: d.price,
      imageUrl: uploadedUrl || null,
      category: d.category,
    };
  });

  const preview: LeadPreview = {
    restaurantName: extraction.restaurantName.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim(),
    logoUrl: extraction.logoUrl,
    totalDishes: extraction.dishes.length,
    totalCategories: categories.size,
    sampleDishes,
  };

  await prisma.lead.update({
    where: { id: leadId },
    data: { preview: preview as any, previewAt: new Date() },
  });

  return preview;
}
