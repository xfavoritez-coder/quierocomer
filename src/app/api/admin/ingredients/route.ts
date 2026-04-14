import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const ingredients = await prisma.ingredient.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    take: 10,
  });
  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { name, category } = await req.json();
    if (!name || !category) return NextResponse.json({ error: "name y category requeridos" }, { status: 400 });

    const existing = await prisma.ingredient.findUnique({ where: { name: name.toLowerCase().trim() } });
    if (existing) return NextResponse.json(existing);

    const ingredient = await prisma.ingredient.create({
      data: { name: name.toLowerCase().trim(), category },
    });
    return NextResponse.json(ingredient);
  } catch (e) {
    console.error("[Admin ingredients POST]", e);
    return NextResponse.json({ error: "Error al crear ingrediente" }, { status: 500 });
  }
}
