import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const allergens = await prisma.allergen.findMany({
    orderBy: { position: "asc" },
    include: { ingredients: { select: { id: true, name: true } } },
  });
  return NextResponse.json(allergens);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name requerido" }, { status: 400 });

  const maxPos = await prisma.allergen.findFirst({ orderBy: { position: "desc" }, select: { position: true } });

  const allergen = await prisma.allergen.create({
    data: { name: name.trim().toLowerCase(), position: (maxPos?.position ?? -1) + 1 },
  });
  return NextResponse.json(allergen);
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { allergenId, linkIngredientId, unlinkIngredientId } = await req.json();
  if (!allergenId) return NextResponse.json({ error: "allergenId requerido" }, { status: 400 });

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
