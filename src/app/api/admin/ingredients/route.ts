import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const dishId = req.nextUrl.searchParams.get("dishId");

  const ingredients = await prisma.ingredient.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, isAllergen: true, allergenType: true },
  });

  let linkedIds: string[] = [];
  if (dishId) {
    const links = await prisma.dishIngredient.findMany({ where: { dishId }, select: { ingredientId: true } });
    linkedIds = links.map(l => l.ingredientId);
  }

  return NextResponse.json({ ingredients, linkedIds });
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { name, category } = await req.json();
    if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 });

    const ingredient = await prisma.ingredient.upsert({
      where: { name: name.toLowerCase().trim() },
      update: {},
      create: { name: name.toLowerCase().trim(), category: category || "OTHER" },
    });
    return NextResponse.json({ ingredient });
  } catch (e) {
    console.error("[Admin ingredients POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
