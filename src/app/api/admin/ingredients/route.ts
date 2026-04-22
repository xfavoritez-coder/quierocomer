import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

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

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id, name, category, isAllergen, allergenType } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name.toLowerCase().trim();
    if (category !== undefined) data.category = category;
    if (isAllergen !== undefined) data.isAllergen = isAllergen;
    if (allergenType !== undefined) data.allergenType = allergenType || null;

    const ingredient = await prisma.ingredient.update({ where: { id }, data });
    return NextResponse.json({ ingredient });
  } catch (e) {
    console.error("[Admin ingredients PUT]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    // Check if used
    const count = await prisma.dishIngredient.count({ where: { ingredientId: id } });
    if (count > 0) return NextResponse.json({ error: `No se puede eliminar: usado en ${count} plato(s)` }, { status: 400 });

    await prisma.ingredient.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Admin ingredients DELETE]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
