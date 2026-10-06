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

    const aprendizajes = await prisma.franAprendizaje.findMany({
      where: { proyectoId },
      orderBy: { createdAt: "desc" },
      include: { bitacora: { select: { id: true, titulo: true } } },
    });

    return NextResponse.json({ aprendizajes });
  } catch (error) {
    console.error("[fran/aprendizajes GET]", error);
    return NextResponse.json(
      { error: "Error al obtener aprendizajes" },
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
      bitacoraId,
      titulo,
      aprendizaje,
      problema,
      causa,
      decision,
      resultado,
      aplicacionFutura,
    } = body;

    if (!proyectoId || !titulo?.trim() || !aprendizaje?.trim()) {
      return NextResponse.json(
        { error: "proyectoId, titulo y aprendizaje son requeridos" },
        { status: 400 }
      );
    }

    const nuevo = await prisma.franAprendizaje.create({
      data: {
        proyectoId,
        bitacoraId: bitacoraId || null,
        titulo: titulo.trim(),
        aprendizaje: aprendizaje.trim(),
        problema: problema || null,
        causa: causa || null,
        decision: decision || null,
        resultado: resultado || null,
        aplicacionFutura: aplicacionFutura || null,
      },
    });

    return NextResponse.json({ aprendizaje: nuevo });
  } catch (error) {
    console.error("[fran/aprendizajes POST]", error);
    return NextResponse.json(
      { error: "Error al crear aprendizaje" },
      { status: 500 }
    );
  }
}
