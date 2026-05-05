import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mapa de sinonimos: si la DB tiene ambos, devolvemos solo el canonico
// canonico → [synonyms]. El nombre canonico es el que usa el codigo internamente.
const SYNONYMS: Record<string, string[]> = {
  soja: ["soya"],
};

// Public endpoint: returns all allergens + restrictions for genio onboarding
export async function GET() {
  try {
    const items = await prisma.allergen.findMany({
      orderBy: [{ type: "asc" }, { position: "asc" }],
      select: { id: true, name: true, type: true },
    });
    // Dedupe por sinonimos
    const aliasOf: Record<string, string> = {};
    for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
      for (const s of synonyms) aliasOf[s] = canonical;
    }
    const seen = new Set<string>();
    const filtered = items.filter(it => {
      const canonical = aliasOf[it.name] || it.name;
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    });
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Restrictions error:", error);
    return NextResponse.json({ error: "Error al obtener restricciones" }, { status: 500 });
  }
}
