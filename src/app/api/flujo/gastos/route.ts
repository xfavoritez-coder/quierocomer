import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

export async function GET() {
  const gastos = await prisma.$queryRaw<
    { id: string; monto: number; comentario: string; createdAt: Date }[]
  >`SELECT id, monto, comentario, "createdAt" FROM "GastoFlujo" ORDER BY "createdAt" DESC LIMIT 100`;
  return NextResponse.json(gastos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const monto = parseInt(body.monto, 10);
  const comentario = (body.comentario ?? "").trim();
  const categoryId: string | null = body.categoryId || null;
  // fecha en formato "YYYY-MM-DD"; si no viene o es inválida, usar hoy
  const entryDate = body.fecha && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha)
    ? new Date(body.fecha + "T12:00:00")
    : new Date();

  if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Categoría requerida" }, { status: 400 });

  const [gasto] = await prisma.$queryRaw<{ id: string; monto: number; comentario: string; createdAt: Date }[]>`
    INSERT INTO "GastoFlujo" (id, monto, comentario, "createdAt")
    VALUES (gen_random_uuid(), ${monto}, ${comentario}, ${entryDate})
    RETURNING id, monto, comentario, "createdAt"
  `;

  // Si viene con categoría, también registrar en el módulo financiero
  if (categoryId) {
    try {
      const cat = await prisma.financialCategory.findUnique({ where: { id: categoryId }, select: { type: true } });
      if (cat) {
        await prisma.financialEntry.create({
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
      }
    } catch { /* no bloquear si falla */ }
  }

  return NextResponse.json(gasto, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await prisma.$executeRaw`DELETE FROM "GastoFlujo" WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
