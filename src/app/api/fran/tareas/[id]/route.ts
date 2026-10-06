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
      descripcion,
      estado,
      prioridad,
      peso,
      motivoBloqueo,
      responsable,
      fechaLimite,
      fechaCompletada,
      costoEstimado,
      costoReal,
      proveedor,
      notas,
      orden,
    } = body;

    const data: Record<string, unknown> = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (estado !== undefined) data.estado = estado;
    if (prioridad !== undefined) data.prioridad = prioridad;
    if (peso !== undefined) data.peso = peso;
    if (motivoBloqueo !== undefined) data.motivoBloqueo = motivoBloqueo;
    if (responsable !== undefined) data.responsable = responsable;
    if (fechaLimite !== undefined)
      data.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
    if (fechaCompletada !== undefined)
      data.fechaCompletada = fechaCompletada ? new Date(fechaCompletada) : null;
    if (costoEstimado !== undefined) data.costoEstimado = costoEstimado;
    if (costoReal !== undefined) data.costoReal = costoReal;
    if (proveedor !== undefined) data.proveedor = proveedor;
    if (notas !== undefined) data.notas = notas;
    if (orden !== undefined) data.orden = orden;

    const tarea = await prisma.franTarea.update({
      where: { id },
      data,
    });

    return NextResponse.json({ tarea });
  } catch (error) {
    console.error("[fran/tareas PATCH]", error);
    return NextResponse.json(
      { error: "Error al actualizar tarea" },
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
    await prisma.franTarea.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[fran/tareas DELETE]", error);
    return NextResponse.json(
      { error: "Error al eliminar tarea" },
      { status: 500 }
    );
  }
}
