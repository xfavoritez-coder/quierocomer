import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  const local = await prisma.local.findUnique({
    where: { id },
    include: { menuItems: { select: { id: true, nombre: true, categoria: true, precio: true, isAvailable: true } } },
  });
  if (!local) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { password: _, ...safe } = local as Record<string, unknown>;
  return NextResponse.json(safe);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    const body = await req.json();
    const local = await prisma.local.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.direccion !== undefined && { direccion: body.direccion }),
        ...(body.comuna !== undefined && { comuna: body.comuna }),
        ...(body.telefono !== undefined && { telefono: body.telefono }),
        ...(body.instagram !== undefined && { instagram: body.instagram }),
        ...(body.sitioWeb !== undefined && { sitioWeb: body.sitioWeb }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.portadaUrl !== undefined && { portadaUrl: body.portadaUrl }),
        ...(body.categorias !== undefined && { categorias: body.categorias }),
        ...(body.activo !== undefined && { activo: body.activo }),
        ...(body.lat !== undefined && { lat: body.lat }),
        ...(body.lng !== undefined && { lng: body.lng }),
        ...(body.linkPedido !== undefined && { linkPedido: body.linkPedido }),
      },
    });
    const { password: _, ...safe } = local as Record<string, unknown>;
    return NextResponse.json(safe);
  } catch (e) {
    console.error("[Admin local PUT]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    await prisma.local.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Admin local DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
