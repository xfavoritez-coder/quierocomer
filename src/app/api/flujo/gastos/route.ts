import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

export async function GET() {
  const entries = await prisma.financialEntry.findMany({
    where: { restaurantId: HORUS_ID, source: "FLUJO" },
    include: { category: { select: { name: true, icon: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      monto: e.amount,
      comentario: e.description ?? "",
      createdAt: e.date,
      categoryName: e.category.name,
      categoryIcon: e.category.icon,
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const monto = parseInt(body.monto, 10);
  const comentario = (body.comentario ?? "").trim();
  const categoryId: string | null = body.categoryId || null;
  const entryDate = body.fecha && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha)
    ? new Date(body.fecha + "T12:00:00")
    : new Date();

  if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Categoría requerida" }, { status: 400 });

  // Registrar en GastoFlujo (historial legacy)
  await prisma.$executeRaw`
    INSERT INTO "GastoFlujo" (id, monto, comentario, "createdAt")
    VALUES (gen_random_uuid(), ${monto}, ${comentario}, ${entryDate})
  `;

  // Registrar en FinancialEntry (fuente de verdad con categoría)
  const cat = await prisma.financialCategory.findUnique({ where: { id: categoryId }, select: { type: true, name: true, icon: true } });
  if (!cat) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 400 });

  const entry = await prisma.financialEntry.create({
    data: {
      restaurantId: HORUS_ID,
      categoryId,
      amount: monto,
      type: cat.type,
      date: entryDate,
      description: comentario,
      source: "FLUJO",
    },
  });

  return NextResponse.json({
    id: entry.id,
    monto: entry.amount,
    comentario: entry.description ?? "",
    createdAt: entry.date,
    categoryName: cat.name,
    categoryIcon: cat.icon,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await prisma.financialEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
