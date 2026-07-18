import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  if (!monto || monto <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!comentario) return NextResponse.json({ error: "Comentario requerido" }, { status: 400 });

  const [gasto] = await prisma.$queryRaw<{ id: string; monto: number; comentario: string; createdAt: Date }[]>`
    INSERT INTO "GastoFlujo" (id, monto, comentario, "createdAt")
    VALUES (gen_random_uuid(), ${monto}, ${comentario}, NOW())
    RETURNING id, monto, comentario, "createdAt"
  `;
  return NextResponse.json(gasto, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await prisma.$executeRaw`DELETE FROM "GastoFlujo" WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
