import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { etapaId, titulo, orden } = body;

    if (!etapaId || !titulo?.trim()) {
      return NextResponse.json(
        { error: "etapaId y titulo son requeridos" },
        { status: 400 }
      );
    }

    const tarea = await prisma.franTarea.create({
      data: {
        etapaId,
        titulo: titulo.trim(),
        orden: orden ?? 0,
        estado: "PENDIENTE",
        prioridad: "MEDIA",
        peso: 1,
      },
    });

    return NextResponse.json({ tarea });
  } catch (error) {
    console.error("[fran/tareas POST]", error);
    return NextResponse.json({ error: "Error al crear tarea" }, { status: 500 });
  }
}
