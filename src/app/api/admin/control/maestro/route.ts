import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

/** GET /api/admin/control/maestro — catálogo completo de InsumoMaestro */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const insumos = await prisma.insumoMaestro.findMany({
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, categoria: true, unidadBase: true, aliases: true },
  });

  return NextResponse.json(insumos);
}
