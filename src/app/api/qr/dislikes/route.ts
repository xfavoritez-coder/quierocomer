import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — search ingredients for dislike picker + top 10 most common dislikes
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");

    // Search mode: return matching ingredients
    if (q && q.length >= 2) {
      const ingredients = await prisma.ingredient.findMany({
        where: { name: { contains: q.toLowerCase(), mode: "insensitive" } },
        select: { name: true, nameEn: true, namePt: true },
        orderBy: { name: "asc" },
        take: 10,
      });
      return NextResponse.json({ results: ingredients.map(i => i.name), ingredientsI18n: ingredients });
    }

    // Default mode: return top 10 most common dislikes
    const guests = await prisma.guestProfile.findMany({
      where: { preferences: { not: undefined } },
      select: { preferences: true },
      take: 5000,
    });

    const counts: Record<string, number> = {};
    for (const g of guests) {
      const prefs = g.preferences as any;
      if (prefs?.dislikes && Array.isArray(prefs.dislikes)) {
        for (const d of prefs.dislikes) {
          counts[d.toLowerCase()] = (counts[d.toLowerCase()] || 0) + 1;
        }
      }
    }

    const EXCLUDE = ["picante", "_spicy", "spicy"];
    const sorted = Object.entries(counts).filter(([name]) => !EXCLUDE.includes(name)).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);

    // Fallback defaults if not enough data
    const defaults = ["palta", "cebolla", "tomate", "cilantro", "ajo", "pepino", "aceitunas", "champiñones", "soya", "jengibre"];
    const popular = sorted.length >= 5 ? sorted : defaults;

    // Fetch translations for popular ingredients
    const ingTranslations = await prisma.ingredient.findMany({
      where: { name: { in: popular, mode: "insensitive" } },
      select: { name: true, nameEn: true, namePt: true },
    });
    const i18nMap: Record<string, { en?: string; pt?: string }> = {};
    for (const i of ingTranslations) {
      i18nMap[i.name.toLowerCase()] = { en: i.nameEn || undefined, pt: i.namePt || undefined };
    }

    return NextResponse.json({ popular, i18nMap });
  } catch (error) {
    console.error("Dislikes error:", error);
    return NextResponse.json({ error: "Error al obtener dislikes" }, { status: 500 });
  }
}
