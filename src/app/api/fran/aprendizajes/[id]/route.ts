import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();

    const {
      titulo,
      aprendizaje,
      problema,
      causa,
      decision,
      resultado,
      aplicacionFutura,
    } = body;

    const data: Record<string, unknown> = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (aprendizaje !== undefined) data.aprendizaje = aprendizaje;
    if (problema !== undefined) data.problema = problema;
    if (causa !== undefined) data.causa = causa;
    if (decision !== undefined) data.decision = decision;
    if (resultado !== undefined) data.resultado = resultado;
    if (aplicacionFutura !== undefined) data.aplicacionFutura = aplicacionFutura;

    const updated = await prisma.franAprendizaje.update({
      where: { id },
      data,
    });

    return NextResponse.json({ aprendizaje: updated });
  } catch (error) {
    console.error("[fran/aprendizajes PATCH]", error);
    return NextResponse.json(
      { error: "Error al actualizar aprendizaje" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    await prisma.franAprendizaje.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[fran/aprendizajes DELETE]", error);
    return NextResponse.json(
      { error: "Error al eliminar aprendizaje" },
      { status: 500 }
    );
  }
}
