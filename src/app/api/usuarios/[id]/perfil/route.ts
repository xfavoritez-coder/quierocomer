import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: { estiloAlimentario: true, comidasFavoritas: true, emailVerificado: true },
    });
    if (!usuario) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(usuario);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (typeof body.nombre === "string" && body.nombre.trim()) data.nombre = body.nombre.trim();
    if (typeof body.telefono === "string") data.telefono = body.telefono.trim() || null;

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

    const updated = await prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nombre: true, telefono: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
