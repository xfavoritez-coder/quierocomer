import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import { extractJusto } from "./justo";
import type { ExtractionResult } from "./types";

export interface LeadPreview {
  restaurantName: string;
  logoUrl: string | null;
  totalDishes: number;
  totalCategories: number;
  sampleDishes: {
    name: string;
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

  if (!lead || !lead.cartaUrl) throw new Error("Lead or cartaUrl missing");

  let extraction: ExtractionResult;

  switch (lead.detectedProvider?.name) {
    case "Justo":
      extraction = await extractJusto(lead.cartaUrl);
      break;
    default:
      throw new Error(`No extractor for provider: ${lead.detectedProvider?.name || "unknown"}`);
  }

  const categories = new Set(extraction.dishes.map((d) => d.category));
  const sample = extraction.dishes.slice(0, 5);

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
      price: d.price,
      imageUrl: uploadedUrl || null, // only use Supabase URLs, never external
      category: d.category,
    };
  });

  const preview: LeadPreview = {
    restaurantName: extraction.restaurantName.split("|")[0].trim(),
    logoUrl: extraction.logoUrl,
    totalDishes: extraction.dishes.length,
    totalCategories: categories.size,
    sampleDishes,
  };

  await prisma.lead.update({
    where: { id: leadId },
    data: { preview: preview as any },
  });

  return preview;
}
