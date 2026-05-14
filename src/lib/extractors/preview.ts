import { prisma } from "@/lib/prisma";
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

/** Fast extraction: fetch menu, grab logo + first 5 dishes, save to lead.preview */
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

  const preview: LeadPreview = {
    restaurantName: extraction.restaurantName.split("|")[0].trim(),
    logoUrl: extraction.logoUrl,
    totalDishes: extraction.dishes.length,
    totalCategories: categories.size,
    sampleDishes: extraction.dishes.slice(0, 5).map((d) => ({
      name: d.name,
      price: d.price,
      imageUrl: d.imageUrl,
      category: d.category,
    })),
  };

  // Save preview to lead
  await prisma.lead.update({
    where: { id: leadId },
    data: { preview: preview as any },
  });

  return preview;
}
