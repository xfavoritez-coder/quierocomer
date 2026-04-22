import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import type { AllergenType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const type = (req.nextUrl.searchParams.get("type") || "ALLERGEN") as AllergenType;

  const allergens = await prisma.allergen.findMany({
    where: { type },
    orderBy: { position: "asc" },
    include: { ingredients: { select: { id: true, name: true } } },
  });
  return NextResponse.json(allergens);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { name, type } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name requerido" }, { status: 400 });

  const maxPos = await prisma.allergen.findFirst({
    where: { type: type || "ALLERGEN" },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const allergen = await prisma.allergen.create({
    data: {
      name: name.trim().toLowerCase(),
      type: type || "ALLERGEN",
      position: (maxPos?.position ?? -1) + 1,
    },
  });
  return NextResponse.json(allergen);
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { allergenId, linkIngredientId, unlinkIngredientId, name } = await req.json();
  if (!allergenId) return NextResponse.json({ error: "allergenId requerido" }, { status: 400 });

  if (name !== undefined) {
    await prisma.allergen.update({
      where: { id: allergenId },
      data: { name: name.trim().toLowerCase() },
    });
  }

  if (linkIngredientId) {
    await prisma.allergen.update({
      where: { id: allergenId },
      data: { ingredients: { connect: { id: linkIngredientId } } },
    });
  }

  if (unlinkIngredientId) {
    await prisma.allergen.update({
      where: { id: allergenId },
      data: { ingredients: { disconnect: { id: unlinkIngredientId } } },
    });
  }

  const updated = await prisma.allergen.findUnique({
    where: { id: allergenId },
    include: { ingredients: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await prisma.allergen.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
