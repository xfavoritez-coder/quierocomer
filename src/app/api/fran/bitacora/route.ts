import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");

    if (!proyectoId) {
      return NextResponse.json(
        { error: "proyectoId es requerido" },
        { status: 400 }
      );
    }

    const entradas = await prisma.franBitacora.findMany({
      where: { proyectoId },
      orderBy: { fecha: "desc" },
      include: { aprendizaje: { select: { id: true } } },
    });

    return NextResponse.json({ entradas });
  } catch (error) {
    console.error("[fran/bitacora GET]", error);
    return NextResponse.json(
      { error: "Error al obtener bitácora" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const {
      proyectoId,
      titulo,
      situacion,
      problema,
      consecuencia,
      accion,
      etiquetas,
      etapaId,
      tareaId,
    } = body;

    if (!proyectoId || !situacion?.trim()) {
      return NextResponse.json(
        { error: "proyectoId y situacion son requeridos" },
        { status: 400 }
      );
    }

    const entrada = await prisma.franBitacora.create({
      data: {
        proyectoId,
        titulo: titulo || null,
        situacion: situacion.trim(),
        problema: problema || null,
        consecuencia: consecuencia || null,
        accion: accion || null,
        etiquetas: etiquetas ?? [],
        etapaId: etapaId || null,
        tareaId: tareaId || null,
      },
    });

    return NextResponse.json({ entrada });
  } catch (error) {
    console.error("[fran/bitacora POST]", error);
    return NextResponse.json(
      { error: "Error al crear entrada" },
      { status: 500 }
    );
  }
}
