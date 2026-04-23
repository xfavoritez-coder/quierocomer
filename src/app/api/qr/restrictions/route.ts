import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint: returns all allergens + restrictions for genio onboarding
export async function GET() {
  try {
    const items = await prisma.allergen.findMany({
      orderBy: [{ type: "asc" }, { position: "asc" }],
      select: { id: true, name: true, type: true },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Restrictions error:", error);
    return NextResponse.json({ error: "Error al obtener restricciones" }, { status: 500 });
  }
}
