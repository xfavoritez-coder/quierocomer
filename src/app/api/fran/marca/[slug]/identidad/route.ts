import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

const IDENTITY_FIELDS = [
  "proposito", "mision", "vision",
  "promesaMarca", "clienteObjetivo", "posicionamiento", "personalidad",
  "queSomos", "queNoSomos",
  "principiosProducto", "principiosExperiencia", "principiosServicio",
  "elementosCore", "elementosFlexibles", "reglasNoNegociables", "libertadesFranquiciado",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { slug } = await params;
  const marca = await prisma.franMarca.findUnique({
    where: { slug },
    include: { identidad: true },
  });
  if (!marca) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  return NextResponse.json({ identidad: marca.identidad ?? null });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { slug } = await params;
  const marca = await prisma.franMarca.findUnique({ where: { slug } });
  if (!marca) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of IDENTITY_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const identidad = await prisma.franIdentidadMarca.upsert({
    where: { marcaId: marca.id },
    update: data,
    create: { marcaId: marca.id, ...data },
  });

  return NextResponse.json({ identidad });
}
